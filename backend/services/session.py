"""
Session service - manage user profile data, chat room state, and matchmaking.

Profile & block data → PostgreSQL (permanent).
Room/message/queue data → Redis (ephemeral, TTL-based).

Redis key schema (ephemeral only):
    room:{room_id}           HASH  - user_a, user_b, username_a, username_b, avatar_a, avatar_b, matched_at, started_at, status, extended
    room:{room_id}:msgs      LIST  - JSON-encoded messages (TTL = 7 days after session end)
    history:{session_id}     LIST  - room_ids newest-first (7-day TTL)
    active_rooms:{session_id} SET   - active room_ids for this session
"""

import json
import time
import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db.redis_client import get_redis
from db.postgres_client import get_session_factory
from db.models import Profile, BlockedUser
from config import get_settings

ROOM_TTL_ACTIVE = 7 * 24 * 3600 + 3600  # 7 days + 1h buffer while active
ROOM_TTL_AFTER  = 7 * 24 * 3600        # 7 days for history


# ─── Profile (PostgreSQL) ─────────────────────────────────────────────────────

async def save_profile(
    session_id: str,
    username: str,
    avatar_id: int = 0,
    age_verified: bool = True,
) -> None:
    # Check if email was verified before profile creation (Redis flag)
    redis = await get_redis()
    early_verified = await redis.get(f"early_email_verified:{session_id}")
    initial_verified = bool(early_verified)

    factory = get_session_factory()
    async with factory() as db:
        stmt = pg_insert(Profile).values(
            session_id=session_id,
            username=username,
            avatar_id=avatar_id,
            age_verified=age_verified,
            email_verified=initial_verified,
            speak_count=0,
            listen_count=0,
            created_at=int(time.time()),
        ).on_conflict_do_update(
            index_elements=["session_id"],
            set_=dict(username=username, avatar_id=avatar_id),
        )
        await db.execute(stmt)
        await db.commit()

    if early_verified:
        await redis.delete(f"early_email_verified:{session_id}")


async def set_email_verified(session_id: str) -> None:
    """Mark a session's email as verified. If profile doesn't exist yet, store a Redis flag."""
    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(
            update(Profile).where(Profile.session_id == session_id).values(email_verified=True)
        )
        await db.commit()
        if result.rowcount == 0:
            # Profile not created yet — store flag in Redis for save_profile to pick up
            redis = await get_redis()
            await redis.setex(f"early_email_verified:{session_id}", 86400, "1")


async def get_profile(session_id: str) -> Optional[dict]:
    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(
            select(Profile).where(Profile.session_id == session_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return {
            "username": row.username,
            "avatar_id": str(row.avatar_id),
            "age_verified": "1" if row.age_verified else "0",
            "email_verified": "1" if row.email_verified else "0",
            "speak_count": str(row.speak_count),
            "listen_count": str(row.listen_count),
            "created_at": str(row.created_at),
        }


# ─── Room ─────────────────────────────────────────────────────────────────────

async def create_room(session_a: str, session_b: str) -> str:
    redis = await get_redis()
    settings = get_settings()

    existing_room_id = await find_active_room_between_sessions(session_a, session_b)
    if existing_room_id:
        return existing_room_id

    room_id = str(uuid.uuid4())
    matched_at = int(time.time())
    duration = settings.CHAT_SESSION_MINUTES * 60

    # Embed usernames so history can display peer name without fetching messages
    profile_a = await get_profile(session_a)
    profile_b = await get_profile(session_b)

    room_fields = {
        "user_a": session_a,
        "user_b": session_b,
        "username_a": profile_a["username"] if profile_a else "",
        "username_b": profile_b["username"] if profile_b else "",
        "avatar_a": profile_a.get("avatar_id", "0") if profile_a else "0",
        "avatar_b": profile_b.get("avatar_id", "0") if profile_b else "0",
        "matched_at": str(matched_at),
        "duration": str(duration),
        "status": "active",
        "extended": "0",
        "first_message_a": "0",
        "first_message_b": "0",
    }
    pipe = redis.pipeline(transaction=False)
    for f, v in room_fields.items():
        pipe.hset(f"room:{room_id}", f, v)
    pipe.expire(f"room:{room_id}", ROOM_TTL_ACTIVE)
    await pipe.execute()

    # Track all active rooms for each participant.
    pipe_active = redis.pipeline(transaction=False)
    pipe_active.sadd(f"active_rooms:{session_a}", room_id)
    pipe_active.expire(f"active_rooms:{session_a}", ROOM_TTL_AFTER)
    pipe_active.sadd(f"active_rooms:{session_b}", room_id)
    pipe_active.expire(f"active_rooms:{session_b}", ROOM_TTL_AFTER)
    await pipe_active.execute()

    # Append to per-session history list (newest first, 7-day rolling window)
    pipe2 = redis.pipeline(transaction=False)
    pipe2.lpush(f"history:{session_a}", room_id)
    pipe2.expire(f"history:{session_a}", ROOM_TTL_AFTER)
    pipe2.lpush(f"history:{session_b}", room_id)
    pipe2.expire(f"history:{session_b}", ROOM_TTL_AFTER)
    await pipe2.execute()

    return room_id


async def get_room(room_id: str) -> Optional[dict]:
    redis = await get_redis()
    data = await redis.hgetall(f"room:{room_id}")
    return data if data else None


async def get_room_id_for_session(session_id: str) -> Optional[str]:
    return await get_active_room_id_for_session(session_id)


async def get_active_room_ids_for_session(session_id: str) -> list[str]:
    redis = await get_redis()
    room_ids = await redis.smembers(f"active_rooms:{session_id}")
    if not room_ids:
        return []

    active_room_ids: list[tuple[int, str]] = []
    stale_room_ids: list[str] = []
    for room_id in room_ids:
        room = await get_room(room_id)
        if room and room.get("status") == "active":
            active_room_ids.append((int(room.get("matched_at") or 0), room_id))
        else:
            stale_room_ids.append(room_id)

    if stale_room_ids:
        await redis.srem(f"active_rooms:{session_id}", *stale_room_ids)

    active_room_ids.sort(reverse=True)
    return [room_id for _, room_id in active_room_ids]


async def get_active_room_id_for_session(session_id: str) -> Optional[str]:
    room_ids = await get_active_room_ids_for_session(session_id)
    return room_ids[0] if room_ids else None


async def find_active_room_between_sessions(session_a: str, session_b: str) -> Optional[str]:
    session_a_rooms = await get_active_room_ids_for_session(session_a)
    if not session_a_rooms:
        return None

    for room_id in session_a_rooms:
        room = await get_room(room_id)
        if not room or room.get("status") != "active":
            continue
        participants = {room.get("user_a", ""), room.get("user_b", "")}
        if participants == {session_a, session_b}:
            return room_id
    return None


async def end_active_room_for_session(session_id: str) -> Optional[str]:
    room_id = await get_active_room_id_for_session(session_id)
    if not room_id:
        return None

    room = await get_room(room_id)
    if not room:
        return None

    redis = await get_redis()
    peer_session_id = room.get("user_b") if room.get("user_a") == session_id else room.get("user_a", "")
    await close_room(room_id)

    if peer_session_id:
        await redis.publish(f"chat:{peer_session_id}", json.dumps({"type": "peer_left"}))

    return room_id


async def extend_room(room_id: str, extra_minutes: int = 15) -> None:
    redis = await get_redis()
    current_duration = int((await redis.hget(f"room:{room_id}", "duration")) or 0)
    new_duration = current_duration + extra_minutes * 60
    pipe = redis.pipeline(transaction=False)
    pipe.hset(f"room:{room_id}", "duration", str(new_duration))
    pipe.hset(f"room:{room_id}", "extended", "1")
    await pipe.execute()


async def mark_room_message_started(room_id: str, session_id: str) -> Optional[dict]:
    redis = await get_redis()
    room = await get_room(room_id)
    if not room:
        return None

    field = "first_message_a" if room.get("user_a") == session_id else "first_message_b"
    await redis.hset(f"room:{room_id}", field, "1")

    room = await get_room(room_id)
    if not room:
        return None

    if room.get("first_message_a") == "1" and room.get("first_message_b") == "1" and not room.get("started_at"):
        started_at = str(int(time.time()))
        set_started = await redis.hsetnx(f"room:{room_id}", "started_at", started_at)
        if set_started:
            room["started_at"] = started_at
        else:
            room = await get_room(room_id)

    return room


async def close_room(room_id: str) -> None:
    """Mark room as ended and set 7-day TTL on all room keys."""
    redis = await get_redis()
    room = await get_room(room_id)
    if not room:
        return

    participants = [room.get("user_a", ""), room.get("user_b", "")]
    pipe = redis.pipeline(transaction=False)
    pipe.hset(f"room:{room_id}", "status", "ended")
    pipe.hset(f"room:{room_id}", "ended_at", str(int(time.time())))
    pipe.expire(f"room:{room_id}", ROOM_TTL_AFTER)
    pipe.expire(f"room:{room_id}:msgs", ROOM_TTL_AFTER)
    await pipe.execute()

    for session_id in participants:
        if not session_id:
            continue
        await redis.srem(f"active_rooms:{session_id}", room_id)


# ─── Messages ─────────────────────────────────────────────────────────────────

async def append_message(room_id: str, message: dict) -> None:
    redis = await get_redis()
    await redis.rpush(f"room:{room_id}:msgs", json.dumps(message))
    await redis.expire(f"room:{room_id}:msgs", ROOM_TTL_ACTIVE)


async def get_messages(room_id: str, start: int = 0, end: int = -1) -> list[dict]:
    redis = await get_redis()
    raw = await redis.lrange(f"room:{room_id}:msgs", start, end)
    return [json.loads(m) for m in raw]


async def get_room_history(session_id: str) -> list[str]:
    """Return up to 50 room_ids for this session, newest first."""
    redis = await get_redis()
    return await redis.lrange(f"history:{session_id}", 0, 49)


async def increment_speak_count(session_id: str) -> None:
    factory = get_session_factory()
    async with factory() as db:
        await db.execute(
            update(Profile).where(Profile.session_id == session_id)
            .values(speak_count=Profile.speak_count + 1)
        )
        await db.commit()


async def increment_listen_count(session_id: str) -> None:
    factory = get_session_factory()
    async with factory() as db:
        await db.execute(
            update(Profile).where(Profile.session_id == session_id)
            .values(listen_count=Profile.listen_count + 1)
        )
        await db.commit()


async def get_blocked_set(session_id: str) -> set[str]:
    """Return the set of peer session_ids blocked by this session."""
    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(
            select(BlockedUser.blocked_session_id)
            .where(BlockedUser.blocker_session_id == session_id)
        )
        return {row[0] for row in result.all()}
