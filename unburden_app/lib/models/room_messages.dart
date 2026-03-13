import 'chat_message.dart';

class RoomMessages {
  final String status;
  final String peerUsername;
  final int peerAvatarId;
  final String peerSessionId;
  final String startedAt;
  final String duration;
  final List<ChatMessage> messages;

  const RoomMessages({
    required this.status,
    required this.peerUsername,
    required this.peerAvatarId,
    required this.peerSessionId,
    required this.startedAt,
    required this.duration,
    required this.messages,
  });

  factory RoomMessages.fromJson(Map<String, dynamic> json) {
    return RoomMessages(
      status: json['status'] as String? ?? '',
      peerUsername: json['peer_username'] as String? ?? '',
      peerAvatarId: (json['peer_avatar_id'] as num?)?.toInt() ?? 0,
      peerSessionId: json['peer_session_id'] as String? ?? '',
      startedAt: json['started_at'] as String? ?? '',
      duration: json['duration']?.toString() ?? '900',
      messages: (json['messages'] as List?)
              ?.map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
