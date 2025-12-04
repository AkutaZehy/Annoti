/// Utility class for date and time formatting
class DateFormatter {
  /// Format DateTime to a readable string
  /// Format: YYYY-MM-DD HH:MM
  static String formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }

  /// Format DateTime to a short string
  /// Format: MM/DD HH:MM
  static String formatShortDateTime(DateTime dateTime) {
    return '${dateTime.month}/${dateTime.day} ${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }

  /// Format DateTime to ISO 8601 string
  static String formatIso8601(DateTime dateTime) {
    return dateTime.toIso8601String();
  }

  /// Parse ISO 8601 string to DateTime
  static DateTime parseIso8601(String dateString) {
    return DateTime.parse(dateString);
  }
}
