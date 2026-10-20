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

        public UsersController(SssContext context)
        {
            _context = context;
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

        private static object ToDto(UserAccount user) => UserPresentation.ToDto(user);
    }
}
