using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    /// <summary>
    /// Sends one message to everybody in a role, by email.
    ///
    /// There is no inbox inside the app, so "every student inbox" means their
    /// real mailboxes - the address they sign in with. That also means a
    /// broadcast cannot be unsent, which is why the console asks first.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "AdminOnly")]
    public class BroadcastController : ControllerBase
    {
        private readonly SssContext _context;
        private readonly IEmailSender _email;
        private readonly ILogger<BroadcastController> _logger;

        public BroadcastController(
            SssContext context,
            IEmailSender email,
            ILogger<BroadcastController> logger)
        {
            _context = context;
            _email = email;
            _logger = logger;
        }

        /// <summary>The roles a broadcast may be aimed at, in the stored capitalisation.</summary>
        private static readonly string[] KnownRoles = { "Admin", "Lecturer", "Student" };

        public class BroadcastRequest
        {
            public string Title { get; set; } = "";
            public string Content { get; set; } = "";

            /// <summary>
            /// Who it goes to. Empty or missing means everybody, matching the
            /// audience lists on news and surveys.
            /// </summary>
            public List<string>? Audience { get; set; }

            /// <summary>An optional file to send with the message.</summary>
            public IFormFile? Attachment { get; set; }
        }

        /// <summary>
        /// Attachments are capped well below what a mailbox will take, because
        /// the same file is sent once per recipient: a 10 MB file to 300
        /// students is 3 GB over the wire and a swift way to be rate-limited.
        /// </summary>
        private const long MaxAttachmentBytes = 5 * 1024 * 1024;

        /// <summary>
        /// What may be attached, by the type the browser reports. Executables and
        /// scripts are not here: a mail provider would strip or reject them, and
        /// a broadcast is not a way to hand software to a whole year group.
        /// </summary>
        private static readonly string[] AllowedAttachmentTypes =
        {
            "application/pdf",
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "text/plain", "text/csv",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/zip"
        };

        [HttpPost]
        [RequestSizeLimit(MaxAttachmentBytes + (1024 * 1024))]
        public async Task<ActionResult> Send([FromForm] BroadcastRequest request)
        {
            if (request == null
                || string.IsNullOrWhiteSpace(request.Title)
                || string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest(new { message = "A title and a message are required" });
            }

            List<EmailAttachment>? attachments = null;
            if (request.Attachment is { Length: > 0 } upload)
            {
                if (upload.Length > MaxAttachmentBytes)
                {
                    return BadRequest(new { message = "That file is larger than 5 MB." });
                }

                var uploadType = (upload.ContentType ?? "").Trim().ToLowerInvariant();
                if (!AllowedAttachmentTypes.Contains(uploadType))
                {
                    return BadRequest(new { message = "That kind of file cannot be attached." });
                }

                using var buffer = new MemoryStream();
                await upload.CopyToAsync(buffer);

                // Only the last segment of whatever the browser sent, so a name
                // carrying a path cannot reach outside anything downstream.
                var safeName = Path.GetFileName(upload.FileName);
                if (string.IsNullOrWhiteSpace(safeName))
                {
                    safeName = "attachment";
                }

                attachments = new List<EmailAttachment>
                {
                    new(safeName, uploadType, buffer.ToArray())
                };
            }

            var roles = (request.Audience ?? new List<string>())
                .Select(role => KnownRoles.FirstOrDefault(known =>
                    string.Equals(known, role?.Trim(), StringComparison.OrdinalIgnoreCase)))
                .Where(role => role != null)
                .Select(role => role!)
                .Distinct()
                .ToList();

            if (request.Audience?.Count > 0 && roles.Count == 0)
            {
                return BadRequest(new { message = "Audience must be Admin, Lecturer or Student." });
            }

            var query = _context.UserAccounts.Where(user => user.Email != null && user.Email != "");
            if (roles.Count > 0)
            {
                query = query.Where(user => roles.Contains(user.Role));
            }

            var recipients = await query
                .Select(user => new { user.Email, user.FirstName })
                .ToListAsync();

            if (recipients.Count == 0)
            {
                return Ok(new { sent = 0, failed = 0, message = "Nobody is in that audience." });
            }

            var sent = 0;
            var failed = 0;

            foreach (var recipient in recipients)
            {
                var body = string.Join(Environment.NewLine, new[]
                {
                    $"Hello {recipient.FirstName},",
                    "",
                    request.Content.Trim(),
                    "",
                    "- Student Survey System",
                    ""
                });

                try
                {
                    // One message each, rather than one with everybody on it: a
                    // broadcast must not hand every recipient the whole mailing
                    // list. A single address that will not accept mail then
                    // fails on its own instead of taking the batch with it.
                    await _email.SendAsync(recipient.Email!, request.Title.Trim(), body, attachments);
                    sent++;
                }
                catch (Exception exception)
                {
                    failed++;
                    _logger.LogError(exception, "Broadcast could not be delivered to one recipient.");
                }
            }

            _logger.LogInformation(
                "Broadcast sent to {Sent} of {Total} recipients.", sent, recipients.Count);

            return Ok(new
            {
                sent,
                failed,
                total = recipients.Count,
                audience = roles.Count > 0 ? roles : KnownRoles.ToList(),
                attachment = attachments?.FirstOrDefault()?.FileName
            });
        }
    }
}
