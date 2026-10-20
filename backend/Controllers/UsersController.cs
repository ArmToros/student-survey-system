using backend.Models;
using backend.Services;
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
        private readonly PasswordSecurity _passwords;

        public UsersController(SssContext context, IWebHostEnvironment environment, PasswordSecurity passwords)
        {
            _context = context;
            _environment = environment;
            _passwords = passwords;
        }

        /// <summary>
        /// Everything an account holds. Who may change which part is decided in
        /// <see cref="Update"/>: the profile belongs to admins, the preferences
        /// to the person themselves.
        /// </summary>
        public class UpdateUserRequest
        {
            public string? FirstName { get; set; }
            public string? LastName { get; set; }
            public string? MiddleName { get; set; }
            public string? Email { get; set; }
            public string? Phone { get; set; }
            public string? Address { get; set; }
            public string? Role { get; set; }
            public DateTime? JoinDate { get; set; }

            // Student fields, ignored for anyone who is not one.
            public string? StudentId { get; set; }
            public string? Major { get; set; }
            public string? Degree { get; set; }
            public int? StartYear { get; set; }

            // Lecturer field, likewise.
            public string? Department { get; set; }

            // The two the account holder sets for themselves.
            public string? Language { get; set; }
            public string? Theme { get; set; }

            /// <summary>
            /// The settings page's switches. Sent whole and stored whole; omitting
            /// it leaves whatever is already saved untouched.
            /// </summary>
            public JsonElement? Preferences { get; set; }
        }

        public class CreateUserRequest : UpdateUserRequest
        {
            public string Password { get; set; } = "";
        }

        /// <summary>The id in the claims, so a caller cannot act as another account.</summary>
        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        /// <summary>A user may read their own account; an admin may read any.</summary>
        private bool CanAccess(int id) => IsAdmin || CallerId == id;

        private bool IsAdmin => User.IsInRole("admin");

        private static readonly string[] KnownDegrees = { "Bachelor", "Master", "PhD" };
        private static readonly string[] KnownRoles = { "Admin", "Lecturer", "Student" };

        [HttpGet("{id:int}")]
        public async Task<ActionResult> GetById(int id)
        {
            if (!CanAccess(id))
            {
                return Forbid();
            }

            var user = await LoadUserAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            return Ok(ToDto(user));
        }

        /// <summary>Every account, for the admin console. Admins only.</summary>
        [HttpGet]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> GetAll()
        {
            var users = await _context.UserAccounts
                .Include(item => item.StudentDatum)
                .Include(item => item.LecturerDatum)
                .OrderBy(item => item.Id)
                .ToListAsync();

            return Ok(users.Select(ToDto));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult> Update(int id, [FromBody] UpdateUserRequest request)
        {
            if (!CanAccess(id))
            {
                return Forbid();
            }

            var user = await LoadUserAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Who someone is - their name, address, role, course details - is
            // administrative data, so only an admin may change it. Anyone else
            // asks support. What is left is how the app looks and behaves for
            // them, which is theirs to set.
            if (IsAdmin)
            {
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
                user.MiddleName = request.MiddleName?.Trim() ?? user.MiddleName;
                user.Phone = request.Phone?.Trim() ?? user.Phone;
                user.Address = request.Address?.Trim() ?? user.Address;
                user.JoinDate = request.JoinDate ?? user.JoinDate;

                var roleError = ApplyRole(user, request.Role);
                if (roleError != null)
                {
                    return BadRequest(new { message = roleError });
                }

                var profileError = await ApplyRoleProfileAsync(user, request);
                if (profileError != null)
                {
                    return BadRequest(new { message = profileError });
                }
            }

            // The app sends 'am' / 'dark'; store "Armenian" / "Dark" like the existing rows.
            user.Language = UserPresentation.ToStoredLanguage(request.Language) ?? user.Language;
            user.Theme = UserPresentation.ToStoredTheme(request.Theme) ?? user.Theme;

            if (request.Preferences.HasValue &&
                request.Preferences.Value.ValueKind == JsonValueKind.Object)
            {
                user.Preferences = request.Preferences.Value.GetRawText();
            }

            await _context.SaveChangesAsync();

            return Ok(ToDto(await LoadUserAsync(id) ?? user));
        }

        /// <summary>Creates an account. Admins only.</summary>
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> Create([FromBody] CreateUserRequest request)
        {
            if (request == null ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.FirstName) ||
                string.IsNullOrWhiteSpace(request.LastName))
            {
                return BadRequest(new { message = "A first name, last name and email are required" });
            }

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            {
                return BadRequest(new { message = "A password of at least 8 characters is required" });
            }

            var email = request.Email.Trim().ToLowerInvariant();
            if (await _context.UserAccounts.AnyAsync(item => item.Email != null && item.Email.ToLower() == email))
            {
                return BadRequest(new { message = "Email already exists" });
            }

            var user = new UserAccount
            {
                // UserAccount.ID is not an identity column, so the key is allocated here.
                Id = await _context.UserAccounts.AnyAsync()
                    ? await _context.UserAccounts.MaxAsync(item => item.Id) + 1
                    : 1,
                Email = email,
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                MiddleName = request.MiddleName?.Trim(),
                Phone = request.Phone?.Trim(),
                Address = request.Address?.Trim(),
                PasswordHash = _passwords.Hash(request.Password),
                JoinDate = request.JoinDate ?? DateTime.UtcNow,
                Language = "English",
                Theme = "Light"
            };

            var roleError = ApplyRole(user, string.IsNullOrWhiteSpace(request.Role) ? "Student" : request.Role);
            if (roleError != null)
            {
                return BadRequest(new { message = roleError });
            }

            _context.UserAccounts.Add(user);
            await _context.SaveChangesAsync();

            var profileError = await ApplyRoleProfileAsync(user, request);
            if (profileError != null)
            {
                return BadRequest(new { message = profileError });
            }

            await _context.SaveChangesAsync();

            return Ok(ToDto(await LoadUserAsync(user.Id) ?? user));
        }

        /// <summary>
        /// Removes an account and the rows that hang off it. Admins only, and an
        /// admin cannot remove themselves - that is almost always a mistake, and
        /// it could leave nobody able to administer anything.
        /// </summary>
        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> Delete(int id)
        {
            if (CallerId == id)
            {
                return BadRequest(new { message = "You cannot delete your own account." });
            }

            var user = await LoadUserAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Everything that points at this account has to go first, or the
            // foreign keys refuse. Surveys and news they authored are left alone
            // deliberately: removing a person should not erase what the
            // institution published.
            var authored = await _context.Surveys.AnyAsync(item => item.CreatedBy == id)
                || await _context.News.AnyAsync(item => item.CreatedBy == id)
                || await _context.Chats.AnyAsync(item => item.CreatedBy == id || item.AssignedAdmin == id);

            if (authored)
            {
                return BadRequest(new
                {
                    message = "This account has created surveys, news or support conversations, so it cannot be deleted without removing those first."
                });
            }

            var sessions = await _context.SurveySessions.Where(item => item.UserId == id).Select(item => item.Id).ToListAsync();
            if (sessions.Count > 0)
            {
                var answers = await _context.SurveyAnswers.Where(item => sessions.Contains(item.SessionId)).ToListAsync();
                _context.SurveyAnswers.RemoveRange(answers);
                _context.SurveySessions.RemoveRange(
                    await _context.SurveySessions.Where(item => item.UserId == id).ToListAsync());
            }

            _context.PasswordResetTokens.RemoveRange(
                await _context.PasswordResetTokens.Where(item => item.UserId == id).ToListAsync());

            if (user.StudentDatum != null)
            {
                // Enrolments first: StudentCourse points at this student.
                user.StudentDatum.Courses.Clear();
                _context.StudentData.Remove(user.StudentDatum);
            }

            if (user.LecturerDatum != null)
            {
                _context.LecturerData.Remove(user.LecturerDatum);
            }

            RemoveStoredPhoto(user.PhotoUrl);
            _context.UserAccounts.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Account deleted" });
        }

        private Task<UserAccount?> LoadUserAsync(int id) =>
            _context.UserAccounts
                .Include(item => item.StudentDatum)
                    .ThenInclude(student => student!.Courses)
                .Include(item => item.LecturerDatum)
                .FirstOrDefaultAsync(item => item.Id == id);

        /// <summary>Sets the role, keeping the stored capitalisation of the existing rows.</summary>
        private static string? ApplyRole(UserAccount user, string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                return null;
            }

            var match = KnownRoles.FirstOrDefault(known =>
                string.Equals(known, role.Trim(), StringComparison.OrdinalIgnoreCase));

            if (match == null)
            {
                return "Role must be Admin, Lecturer or Student.";
            }

            user.Role = match;
            return null;
        }

        /// <summary>
        /// Keeps StudentData and LecturerData in step with the role: a student
        /// gets a StudentData row, a lecturer a LecturerData row, and changing
        /// role removes the one that no longer applies.
        /// </summary>
        private async Task<string?> ApplyRoleProfileAsync(UserAccount user, UpdateUserRequest request)
        {
            var role = UserPresentation.ToRole(user.Role);

            if (role == "student")
            {
                if (user.LecturerDatum != null)
                {
                    _context.LecturerData.Remove(user.LecturerDatum);
                    user.LecturerDatum = null;
                }

                var student = user.StudentDatum
                    ?? await _context.StudentData.FirstOrDefaultAsync(item => item.Id == user.Id);

                if (student == null)
                {
                    student = new StudentDatum { Id = user.Id, StudentId = request.StudentId?.Trim() ?? $"STU-{DateTime.UtcNow:yyyy}-{user.Id:D3}" };
                    _context.StudentData.Add(student);
                    user.StudentDatum = student;
                }
                else if (!string.IsNullOrWhiteSpace(request.StudentId))
                {
                    student.StudentId = request.StudentId.Trim();
                }

                student.Major = request.Major?.Trim() ?? student.Major;
                student.StartYear = request.StartYear ?? student.StartYear;

                if (!string.IsNullOrWhiteSpace(request.Degree))
                {
                    var degree = KnownDegrees.FirstOrDefault(known =>
                        string.Equals(known, request.Degree.Trim(), StringComparison.OrdinalIgnoreCase));

                    if (degree == null)
                    {
                        return "Degree must be Bachelor, Master or PhD.";
                    }

                    student.Degree = degree;
                }

                student.Degree ??= "Bachelor";
                return null;
            }

            if (role == "lecturer")
            {
                if (user.StudentDatum != null)
                {
                    user.StudentDatum.Courses.Clear();
                    _context.StudentData.Remove(user.StudentDatum);
                    user.StudentDatum = null;
                }

                var lecturer = user.LecturerDatum
                    ?? await _context.LecturerData.FirstOrDefaultAsync(item => item.Id == user.Id);

                if (lecturer == null)
                {
                    lecturer = new LecturerDatum { Id = user.Id };
                    _context.LecturerData.Add(lecturer);
                    user.LecturerDatum = lecturer;
                }

                lecturer.Department = request.Department?.Trim() ?? lecturer.Department;
                return null;
            }

            // An admin carries neither set of details.
            if (user.StudentDatum != null)
            {
                user.StudentDatum.Courses.Clear();
                _context.StudentData.Remove(user.StudentDatum);
                user.StudentDatum = null;
            }

            if (user.LecturerDatum != null)
            {
                _context.LecturerData.Remove(user.LecturerDatum);
                user.LecturerDatum = null;
            }

            return null;
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
