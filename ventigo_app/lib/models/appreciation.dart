class Appreciation {
  final int id;
  final String fromUsername;
  final String fromRole;
  final String message;
  final int createdAt;

  const Appreciation({
    required this.id,
    required this.fromUsername,
    required this.fromRole,
    required this.message,
    required this.createdAt,
  });

  factory Appreciation.fromJson(Map<String, dynamic> json) {
    return Appreciation(
      id: (json['id'] as num).toInt(),
      fromUsername: json['from_username'] as String,
      fromRole: json['from_role'] as String,
      message: json['message'] as String,
      createdAt: (json['created_at'] as num).toInt(),
    );
  }
}
