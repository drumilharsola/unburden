const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export interface SpeakerRequest {
  request_id: string;
  session_id: string;
  username: string;
  avatar_id: string;
  posted_at: string;
}

export interface RoomSummary {
  room_id: string;
  status: string;          // "active" | "ended"
  started_at: string;     // unix timestamp string
  ended_at: string;       // unix timestamp string, or ""
  peer_username: string;
  peer_avatar_id: number;
}

export interface RoomMessages extends RoomSummary {
  messages: Array<{
    type: "message";
    from: string;
    text: string;
    ts: number;
  }>;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ token: string; session_id: string; has_profile: boolean; email_verified: boolean }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  login: (email: string, password: string) =>
    request<{ token: string; session_id: string; has_profile: boolean; email_verified: boolean }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  sendVerification: (token: string) =>
    request<{ message: string }>("/auth/send-verification", { method: "POST" }, token),

  verifyEmail: (verifyToken: string) =>
    request<{ token: string; session_id: string; has_profile: boolean; email_verified: boolean }>(
      `/auth/verify-email?token=${encodeURIComponent(verifyToken)}`
    ),

  setProfile: (token: string, data: { dob: string; avatar_id: number }) =>
    request<{ username: string; avatar_id: number }>(
      "/auth/profile",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  getMe: (token: string) =>
    request<{ username: string; avatar_id: number; speak_count: number; listen_count: number; member_since: string }>(
      "/auth/me",
      {},
      token
    ),

  updateProfile: (token: string, data: { avatar_id?: number; reroll_username?: boolean }) =>
    request<{ username: string; avatar_id: number }>(
      "/auth/profile",
      { method: "PATCH", body: JSON.stringify(data) },
      token
    ),

  getUserProfile: (token: string, username: string) =>
    request<{ username: string; avatar_id: number; speak_count: number; listen_count: number; member_since: string }>(
      `/auth/user/${encodeURIComponent(username)}`,
      {},
      token
    ),

  // Speaker board
  postSpeak: (token: string) =>
    request<{ request_id: string; status: string }>("/board/speak", { method: "POST" }, token),

  cancelSpeak: (token: string) =>
    request("/board/speak", { method: "DELETE" }, token),

  getBoard: (token: string) =>
    request<{ requests: SpeakerRequest[]; my_request_id: string | null }>(
      "/board/requests",
      {},
      token
    ),

  acceptSpeaker: (token: string, requestId: string) =>
    request<{ room_id: string }>(`/board/accept/${encodeURIComponent(requestId)}`, { method: "POST" }, token),

  submitReport: (token: string, reason: string, detail?: string) =>
    request("/report/", { method: "POST", body: JSON.stringify({ reason, detail: detail ?? "" }) }, token),

  // Chat history
  getActiveRoom: (token: string) =>
    request<{ room_id: string | null }>("/chat/active", {}, token),

  getChatRooms: (token: string) =>
    request<{ rooms: RoomSummary[] }>("/chat/rooms", {}, token),

  getRoomMessages: (token: string, roomId: string) =>
    request<RoomMessages>(
      `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
      {},
      token
    ),

};

export const wsUrl = {
  board: (token: string) =>
    `${API.replace("http", "ws")}/board/ws?token=${encodeURIComponent(token)}`,
  chat: (token: string, roomId: string) =>
    `${API.replace("http", "ws")}/chat/ws?token=${encodeURIComponent(token)}&room_id=${encodeURIComponent(roomId)}`,
};
