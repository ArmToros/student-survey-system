using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly SssContext _context;
        private readonly IWebHostEnvironment _environment;

        public UsersController(SssContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        public class UpdateUserRequest
        {
            public string? FirstName { get; set; }
            public string? LastName { get; set; }
            public string? Email { get; set; }
            public string? Phone { get; set; }
            public string? Address { get; set; }
            public string? Language { get; set; }
            public string? Theme { get; set; }

            /// <summary>
            /// The settings page's switches. Sent whole and stored whole; omitting
            /// it leaves whatever is already saved untouched.
            /// </summary>
            public JsonElement? Preferences { get; set; }
        }

        /// <summary>The id in the claims, so a caller cannot act as another account.</summary>
        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        /// <summary>A user may read and change their own account; an admin may change any.</summary>
        private bool CanAccess(int id) => User.IsInRole("admin") || CallerId == id;

        [HttpGet("{id:int}")]
        public async Task<ActionResult> GetById(int id)
        {
            if (!CanAccess(id))
            {
                return Forbid();
            }

            var user = await _context.UserAccounts.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            return Ok(ToDto(user));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult> Update(int id, [FromBody] UpdateUserRequest request)
        {
            if (!CanAccess(id))
            {
                return Forbid();
            }

            var user = await _context.UserAccounts.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var normalizedEmail = request.Email.Trim().ToLowerInvariant();
                var emailTaken = await _context.UserAccounts.AnyAsync(item =>
                    item.Id != id &&
                    item.Email != null &&
                    item.Email.ToLower() == normalizedEmail);

                if (emailTaken)
                {
                    return BadRequest(new { message = "Email already exists" });
                }

                user.Email = normalizedEmail;
            }

            user.FirstName = request.FirstName?.Trim() ?? user.FirstName;
            user.LastName = request.LastName?.Trim() ?? user.LastName;
            user.Phone = request.Phone?.Trim() ?? user.Phone;
            user.Address = request.Address?.Trim() ?? user.Address;

            // The app sends 'am' / 'dark'; store "Armenian" / "Dark" like the existing rows.
            user.Language = UserPresentation.ToStoredLanguage(request.Language) ?? user.Language;
            user.Theme = UserPresentation.ToStoredTheme(request.Theme) ?? user.Theme;

            if (request.Preferences.HasValue &&
                request.Preferences.Value.ValueKind == JsonValueKind.Object)
            {
                user.Preferences = request.Preferences.Value.GetRawText();
            }

            await _context.SaveChangesAsync();

            return Ok(ToDto(user));
        }


        /// <summary>
        /// Profile pictures are written to wwwroot-style storage on disk rather
        /// than into the database, so restoring the SSS backup does not wipe
        /// them and the files are served as ordinary static content.
        /// </summary>
        private const long MaxPhotoBytes = 2 * 1024 * 1024;

        /// <summary>
        /// Only these are accepted, and the extension is taken from this table
        /// rather than from the uploaded file name, which is never trusted.
        /// </summary>
        private static readonly Dictionary<string, string> AllowedPhotoTypes = new()
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["image/gif"] = ".gif"
        };

        [HttpPost("{id:int}/photo")]
        public async Task<ActionResult> UploadPhoto(int id, IFormFile? file)
        {
            if (!CanAccess(id))
            {
                return Forbid();
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file was uploaded" });
            }

            if (file.Length > MaxPhotoBytes)
            {
                return BadRequest(new { message = "That picture is larger than 2 MB." });
            }

            var contentType = (file.ContentType ?? "").Trim().ToLowerInvariant();
            if (!AllowedPhotoTypes.TryGetValue(contentType, out var extension))
            {
                return BadRequest(new { message = "Use a JPEG, PNG, WebP or GIF image." });
            }

            var user = await _context.UserAccounts.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var folder = PhotoFolder();
            Directory.CreateDirectory(folder);

            // The name is generated here, never taken from the upload, so a
            // crafted file name cannot escape the folder or overwrite anything.
            var fileName = $"user-{id}-{Guid.NewGuid():N}{extension}";
            var fullPath = Path.Combine(folder, fileName);

            await using (var target = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(target);
            }

            RemoveStoredPhoto(user.PhotoUrl);

            user.PhotoUrl = "/uploads/avatars/" + fileName;
            await _context.SaveChangesAsync();

            return Ok(ToDto(user));
        }

        [HttpDelete("{id:int}/photo")]
        public async Task<ActionResult> DeletePhoto(int id)
        {
            if (!CanAccess(id))
            {
                return Forbid();
            }

            var user = await _context.UserAccounts.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            RemoveStoredPhoto(user.PhotoUrl);
            user.PhotoUrl = null;
            await _context.SaveChangesAsync();

            return Ok(ToDto(user));
        }

        /// <summary>
        /// Anchored to the content root rather than the current directory, so the
        /// folder is the same whichever directory the app was started from and
        /// photos uploaded earlier stay reachable.
        /// </summary>
        private string PhotoFolder() =>
            Path.Combine(_environment.ContentRootPath, "uploads", "avatars");

        /// <summary>
        /// Deletes the file behind a stored photo URL, ignoring anything that is
        /// not one of ours. A failure here must not fail the request: the row is
        /// what matters, and a stray file is harmless.
        /// </summary>
        private void RemoveStoredPhoto(string? photoUrl)
        {
            if (string.IsNullOrWhiteSpace(photoUrl) || !photoUrl.StartsWith("/uploads/avatars/"))
            {
                return;
            }

            var name = Path.GetFileName(photoUrl);
            if (string.IsNullOrWhiteSpace(name))
            {
                return;
            }

            try
            {
                var path = Path.Combine(PhotoFolder(), name);
                if (System.IO.File.Exists(path))
                {
                    System.IO.File.Delete(path);
                }
            }
            catch (IOException)
            {
                // Locked or already gone; the database is still correct.
            }
        }

        private static object ToDto(UserAccount user) => UserPresentation.ToDto(user);
    }
}
