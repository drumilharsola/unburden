"""Tests for the appreciation feature (routes + service)."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException

from routes.chat import post_appreciation, AppreciationRequest


# -- Helpers -------------------------------------------------------------------

def _ended_room(user_a="sid-1", user_b="sid-2"):
    return {
        "user_a": user_a,
        "user_b": user_b,
        "username_a": "cool_cat",
        "username_b": "brave_bear",
        "status": "ended",
    }


def _active_room(user_a="sid-1", user_b="sid-2"):
    room = _ended_room(user_a, user_b)
    room["status"] = "active"
    return room


def _profile(username="cool_cat"):
    return {
        "username": username,
        "avatar_id": "0",
        "age_verified": "1",
        "email_verified": "1",
        "speak_count": "5",
        "listen_count": "3",
        "appreciation_count": "2",
        "created_at": "1700000000",
    }


# -- POST /chat/rooms/{room_id}/appreciate ------------------------------------

@pytest.mark.asyncio
async def test_appreciate_room_not_found():
    body = AppreciationRequest(message="thanks!")
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=None):
        with pytest.raises(HTTPException) as exc:
            await post_appreciation("room-1", body, {"sub": "sid-1"})
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_appreciate_not_member():
    body = AppreciationRequest(message="thanks!")
    room = _ended_room("other-1", "other-2")
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room):
        with pytest.raises(HTTPException) as exc:
            await post_appreciation("room-1", body, {"sub": "sid-1"})
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_appreciate_room_still_active():
    body = AppreciationRequest(message="thanks!")
    room = _active_room()
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room):
        with pytest.raises(HTTPException) as exc:
            await post_appreciation("room-1", body, {"sub": "sid-1"})
        assert exc.value.status_code == 400
        assert "after the chat ends" in exc.value.detail


@pytest.mark.asyncio
async def test_appreciate_empty_message():
    body = AppreciationRequest(message="   ")
    room = _ended_room()
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room):
        with pytest.raises(HTTPException) as exc:
            await post_appreciation("room-1", body, {"sub": "sid-1"})
        assert exc.value.status_code == 400
        assert "empty" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_appreciate_success_as_venter():
    """user_a is the venter; appreciation goes to user_b (listener)."""
    body = AppreciationRequest(message="You really helped me!")
    room = _ended_room()
    expected = {
        "id": 1,
        "from_username": "cool_cat",
        "from_role": "venter",
        "message": "You really helped me!",
        "created_at": 1700000000,
    }
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room), \
         patch("routes.chat.get_profile", new_callable=AsyncMock, return_value=_profile("cool_cat")), \
         patch("routes.chat.submit_appreciation", new_callable=AsyncMock, return_value=expected) as mock_submit:
        result = await post_appreciation("room-1", body, {"sub": "sid-1"})
        assert result["from_role"] == "venter"
        assert result["from_username"] == "cool_cat"
        mock_submit.assert_called_once_with(
            from_session_id="sid-1",
            to_session_id="sid-2",
            room_id="room-1",
            from_username="cool_cat",
            from_role="venter",
            message="You really helped me!",
        )


@pytest.mark.asyncio
async def test_appreciate_success_as_listener():
    """user_b is the listener; appreciation goes to user_a (venter)."""
    body = AppreciationRequest(message="Stay strong 💪")
    room = _ended_room()
    expected = {
        "id": 2,
        "from_username": "brave_bear",
        "from_role": "listener",
        "message": "Stay strong 💪",
        "created_at": 1700000000,
    }
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room), \
         patch("routes.chat.get_profile", new_callable=AsyncMock, return_value=_profile("brave_bear")), \
         patch("routes.chat.submit_appreciation", new_callable=AsyncMock, return_value=expected) as mock_submit:
        # sid-2 is user_b (listener)
        result = await post_appreciation("room-1", body, {"sub": "sid-2"})
        assert result["from_role"] == "listener"
        mock_submit.assert_called_once_with(
            from_session_id="sid-2",
            to_session_id="sid-1",
            room_id="room-1",
            from_username="brave_bear",
            from_role="listener",
            message="Stay strong 💪",
        )


@pytest.mark.asyncio
async def test_appreciate_duplicate():
    """Second appreciation for the same room returns 409."""
    body = AppreciationRequest(message="thanks again")
    room = _ended_room()
    # Simulate IntegrityError with unique constraint name
    exc = Exception("(sqlalchemy.exc.IntegrityError) uq_appreciation_per_room")
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room), \
         patch("routes.chat.get_profile", new_callable=AsyncMock, return_value=_profile()), \
         patch("routes.chat.submit_appreciation", new_callable=AsyncMock, side_effect=exc):
        with pytest.raises(HTTPException) as raised:
            await post_appreciation("room-1", body, {"sub": "sid-1"})
        assert raised.value.status_code == 409


@pytest.mark.asyncio
async def test_appreciate_sanitizes_html():
    """HTML tags should be stripped from message."""
    body = AppreciationRequest(message="<script>alert('xss')</script>Hello!")
    room = _ended_room()
    expected = {"id": 1, "from_username": "cool_cat", "from_role": "venter",
                "message": "alert('xss')Hello!", "created_at": 1700000000}
    with patch("routes.chat.get_room", new_callable=AsyncMock, return_value=room), \
         patch("routes.chat.get_profile", new_callable=AsyncMock, return_value=_profile()), \
         patch("routes.chat.submit_appreciation", new_callable=AsyncMock, return_value=expected) as mock_submit:
        await post_appreciation("room-1", body, {"sub": "sid-1"})
        # The message passed to submit_appreciation should be sanitized (no tags)
        call_kwargs = mock_submit.call_args[1]
        assert "<script>" not in call_kwargs["message"]


# -- GET /auth/user/{username}/appreciations -----------------------------------

@pytest.mark.asyncio
async def test_get_appreciations_user_not_found():
    from routes.auth import get_user_appreciations
    from tests.conftest import FakeDBSession, FakeResult

    db = FakeDBSession(execute_result=FakeResult(scalar=None))
    factory = MagicMock(return_value=db)
    with patch("routes.auth.get_session_factory", return_value=factory):
        with pytest.raises(HTTPException) as exc:
            await get_user_appreciations("nobody", {"sub": "sid-1"})
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_get_appreciations_blocked():
    from routes.auth import get_user_appreciations
    from tests.conftest import FakeDBSession, FakeResult

    profile_row = MagicMock()
    profile_row.session_id = "owner-sid"
    profile_row.username = "owner"

    db = FakeDBSession(execute_result=FakeResult(scalar=profile_row))
    factory = MagicMock(return_value=db)
    with patch("routes.auth.get_session_factory", return_value=factory), \
         patch("routes.auth.get_blocked_set", new_callable=AsyncMock, return_value={"sid-1"}):
        with pytest.raises(HTTPException) as exc:
            await get_user_appreciations("owner", {"sub": "sid-1"})
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_get_appreciations_success():
    from routes.auth import get_user_appreciations
    from tests.conftest import FakeDBSession, FakeResult

    profile_row = MagicMock()
    profile_row.session_id = "owner-sid"
    profile_row.username = "owner"

    items = [
        {"id": 1, "from_username": "cool_cat", "from_role": "venter", "message": "thanks!", "created_at": 1700000000},
    ]

    db = FakeDBSession(execute_result=FakeResult(scalar=profile_row))
    factory = MagicMock(return_value=db)
    with patch("routes.auth.get_session_factory", return_value=factory), \
         patch("routes.auth.get_blocked_set", new_callable=AsyncMock, return_value=set()), \
         patch("routes.auth.get_appreciations", new_callable=AsyncMock, return_value=items):
        result = await get_user_appreciations("owner", {"sub": "sid-1"})
        assert result["appreciations"] == items
        assert len(result["appreciations"]) == 1


@pytest.mark.asyncio
async def test_get_appreciations_clamps_limit():
    from routes.auth import get_user_appreciations
    from tests.conftest import FakeDBSession, FakeResult

    profile_row = MagicMock()
    profile_row.session_id = "owner-sid"
    profile_row.username = "owner"

    db = FakeDBSession(execute_result=FakeResult(scalar=profile_row))
    factory = MagicMock(return_value=db)
    with patch("routes.auth.get_session_factory", return_value=factory), \
         patch("routes.auth.get_blocked_set", new_callable=AsyncMock, return_value=set()), \
         patch("routes.auth.get_appreciations", new_callable=AsyncMock, return_value=[]) as mock_get:
        await get_user_appreciations("owner", {"sub": "sid-1"}, limit=999, offset=-5)
        mock_get.assert_called_once_with("owner-sid", limit=50, offset=0)


# -- Profile endpoints include appreciation_count -----------------------------

@pytest.mark.asyncio
async def test_me_includes_appreciation_count():
    from routes.auth import get_me
    from tests.conftest import FakeDBSession, FakeResult

    user = MagicMock()
    user.email = "test@example.com"

    db = FakeDBSession()
    db.get = AsyncMock(return_value=user)
    factory = MagicMock(return_value=db)

    with patch("routes.auth.get_session_factory", return_value=factory), \
         patch("routes.auth.get_profile", new_callable=AsyncMock, return_value=_profile()):
        result = await get_me({"sub": "sid-1"})
        assert "appreciation_count" in result
        assert result["appreciation_count"] == 2


@pytest.mark.asyncio
async def test_user_profile_includes_appreciation_count():
    from routes.auth import get_user_profile
    from tests.conftest import FakeDBSession, FakeResult

    profile_row = MagicMock()
    profile_row.username = "cool_cat"
    profile_row.avatar_id = 0
    profile_row.speak_count = 5
    profile_row.listen_count = 3
    profile_row.appreciation_count = 2
    profile_row.created_at = 1700000000
    profile_row.session_id = "sid-1"

    db = FakeDBSession(execute_result=FakeResult(scalar=profile_row))
    factory = MagicMock(return_value=db)

    with patch("routes.auth.get_session_factory", return_value=factory), \
         patch("routes.auth.get_blocked_set", new_callable=AsyncMock, return_value=set()):
        result = await get_user_profile("cool_cat", {"sub": "sid-2"})
        assert result["appreciation_count"] == 2
