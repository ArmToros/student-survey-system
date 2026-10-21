using System.Net;
using System.Net.Mail;

namespace backend.Services;

/// <summary>
/// A file to travel with the message, already read into memory. The bytes are
/// held rather than a stream because one broadcast builds a separate message
/// per recipient, and a stream can only be read once.
/// </summary>
public sealed record EmailAttachment(string FileName, string ContentType, byte[] Content);

public interface IEmailSender
{
    Task SendAsync(
        string toAddress,
        string subject,
        string body,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// SMTP settings, read from the environment or .env.
/// <see cref="IsConfigured"/> is false until a host is set, which switches the
/// sender to its development fallback.
/// </summary>
public sealed class SmtpOptions
{
    public string? Host { get; init; }
    public int Port { get; init; } = 587;
    public string? Username { get; init; }
    public string? Password { get; init; }
    public string From { get; init; } = "no-reply@localhost";
    public bool UseSsl { get; init; } = true;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host);

    public static SmtpOptions FromConfiguration(IConfiguration configuration)
    {
        var port = 587;
        if (int.TryParse(configuration["SMTP_PORT"], out var parsedPort) && parsedPort > 0)
        {
            port = parsedPort;
        }

        var useSsl = true;
        if (bool.TryParse(configuration["SMTP_USE_SSL"], out var parsedUseSsl))
        {
            useSsl = parsedUseSsl;
        }

        return new SmtpOptions
        {
            Host = configuration["SMTP_HOST"],
            Port = port,
            Username = configuration["SMTP_USERNAME"],
            Password = configuration["SMTP_PASSWORD"],
            From = string.IsNullOrWhiteSpace(configuration["SMTP_FROM"])
                ? "no-reply@localhost"
                : configuration["SMTP_FROM"]!,
            UseSsl = useSsl
        };
    }
}

/// <summary>
/// Sends mail over SMTP, and writes it to the log instead when SMTP is not
/// configured.
///
/// The fallback keeps the password reset flow usable on a development machine
/// with no mail server: the reset link appears in the backend console. It never
/// silently swallows a real send - if a host is configured and the send fails,
/// the exception propagates.
/// </summary>
public class EmailSender : IEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(SmtpOptions options, ILogger<EmailSender> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task SendAsync(
        string toAddress,
        string subject,
        string body,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
        {
            _logger.LogWarning(
                "SMTP is not configured, so this email was not sent. Set SMTP_HOST in .env to deliver it.\n" +
                "  To:      {To}\n  Subject: {Subject}\n  Files:   {Files}\n{Body}",
                toAddress,
                subject,
                attachments == null || attachments.Count == 0
                    ? "none"
                    : string.Join(", ", attachments.Select(item => item.FileName)),
                body);
            return;
        }

        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrWhiteSpace(_options.Username))
        {
            client.Credentials = new NetworkCredential(_options.Username, _options.Password);
        }

        using var message = new MailMessage(_options.From, toAddress, subject, body)
        {
            IsBodyHtml = false
        };

        // Each attachment owns a stream over its own copy of the bytes, and the
        // MailMessage disposes them along with itself.
        if (attachments != null)
        {
            foreach (var attachment in attachments)
            {
                message.Attachments.Add(new Attachment(
                    new MemoryStream(attachment.Content),
                    attachment.FileName,
                    attachment.ContentType));
            }
        }

        await client.SendMailAsync(message, cancellationToken);

        _logger.LogInformation("Sent {Subject} to a user mailbox.", subject);
    }
}
