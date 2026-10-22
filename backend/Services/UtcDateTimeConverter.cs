using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Services;

/// <summary>
/// Writes every date and time as UTC, with the "Z" that says so.
///
/// The database columns are plain `datetime`: they carry no offset, so a value
/// read back from one has Kind "Unspecified" and System.Text.Json writes it
/// with no marker at all - "2026-10-20T21:35:50.35". A browser reads that as
/// local time, so a value written with DateTime.UtcNow came back four hours
/// early in Armenia, and an article published at 01:35 was shown as 21:35 the
/// day before.
///
/// Everything this app stores is written with UtcNow, so an unmarked value is
/// taken to be UTC and labelled as such. The browser then converts it to
/// whatever zone the reader is in, which is what it was trying to do all along.
///
/// The rows restored from the backup carry times that were never really UTC,
/// so those shift by the offset too. They are seed data with invented times,
/// and consistent handling is worth more than preserving an arbitrary hour.
/// </summary>
public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetDateTime();

        return value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => value
        };

        writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"));
    }
}

/// <summary>The same, for columns that may hold no date at all.</summary>
public sealed class NullableUtcDateTimeConverter : JsonConverter<DateTime?>
{
    private static readonly UtcDateTimeConverter Inner = new();

    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : Inner.Read(ref reader, typeof(DateTime), options);

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value == null)
        {
            writer.WriteNullValue();
            return;
        }

        Inner.Write(writer, value.Value, options);
    }
}
