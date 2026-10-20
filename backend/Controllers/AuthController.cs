using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    [EnableRateLimiting(LoginThrottle.RateLimitPolicy)]
    public class AuthController : ControllerBase
    {
        private readonly SssContext _context;
        private readonly PasswordSecurity _passwords;
        private readonly JwtTokenService _tokens;
        private readonly LoginThrottle _throttle;
        private readonly PasswordResetService _passwordResets;
        private readonly IEmailSender _email;
        private readonly AppUrls _appUrls;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            SssContext context,
            PasswordSecurity passwords,
            JwtTokenService tokens,
            LoginThrottle throttle,
            PasswordResetService passwordResets,
            IEmailSender email,
            AppUrls appUrls,
            ILogger<AuthController> logger)
        {
            _context = context;
            _passwords = passwords;
            _tokens = tokens;
            _throttle = throttle;
            _passwordResets = passwordResets;
            _email = email;
            _appUrls = appUrls;
            _logger = logger;
        }

        public class LoginRequest
        {
            public string Email { get; set; } = "";
            public string Password { get; set; } = "";
        }

        [HttpPost("login")]
        public async Task<ActionResult> Login([FromBody] LoginRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return Unauthorized(new { message = "Invalid credentials" });
            }

            var emailNorm = request.Email.Trim().ToLowerInvariant();

            // Counted against the submitted address whether or not it exists, so a
            // locked response gives nothing away about which accounts are real.
            var lockedFor = _throttle.GetLockoutRemaining(emailNorm);
            if (lockedFor.HasValue)
            {
                Response.Headers.RetryAfter = ((int)lockedFor.Value.TotalSeconds).ToString();
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message = "Too many sign-in attempts. Try again later.",
                    retryAfterSeconds = (int)lockedFor.Value.TotalSeconds
                });
            }

            // The student and lecturer rows come along, so the account the app
            // holds after signing in carries the course details too, not just
            // the name and email.
            var user = await _context.UserAccounts
                .Include(u => u.StudentDatum)
                .Include(u => u.LecturerDatum)
                .FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == emailNorm);

            // Same response whether the address is unknown or the password is wrong,
            // so this cannot be used to discover which accounts exist.
            if (user == null)
            {
                _throttle.RecordFailure(emailNorm);
                return Unauthorized(new { message = "Invalid credentials" });
            }

            var check = _passwords.Check(user.PasswordHash, request.Password);

            if (check == PasswordCheckResult.Failed)
            {
                _throttle.RecordFailure(emailNorm);
                return Unauthorized(new { message = "Invalid credentials" });
            }

            _throttle.RecordSuccess(emailNorm);

            if (check == PasswordCheckResult.ValidNeedsUpgrade)
            {
                // The row still held a plain-text placeholder: replace it with a hash
                // now that the password has been confirmed.
                user.PasswordHash = _passwords.Hash(request.Password);
                await _context.SaveChangesAsync();
            }

            return Ok(BuildSession(user));
        }

        public class PasswordResetRequest
        {
            public string Email { get; set; } = "";
        }

        public class PasswordResetConfirmRequest
        {
            public string Token { get; set; } = "";
            public string Password { get; set; } = "";
        }

        /// <summary>
        /// Starts a password reset: emails a single-use link when the address
        /// belongs to an account.
        ///
        /// The answer is identical for a registered and an unregistered address,
        /// so the endpoint cannot be used to find out which accounts exist. Mail
        /// failures are logged rather than returned, for the same reason.
        /// </summary>
        [HttpPost("password-reset/request")]
        public async Task<ActionResult> RequestPasswordReset([FromBody] PasswordResetRequest request)
        {
            const string NeutralMessage =
                "If that email is registered, password reset instructions have been sent.";

            if (request == null || string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "Email is required" });
            }

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            var user = await _context.UserAccounts.FirstOrDefaultAsync(item =>
                item.Email != null &&
                item.Email.ToLower() == normalizedEmail);

            if (user?.Email != null)
            {
                var token = await _passwordResets.IssueTokenAsync(user);
                var link = _appUrls.PasswordResetLink(token);

                var minutes = (int)PasswordResetService.TokenLifetime.TotalMinutes;

                var body = string.Join(Environment.NewLine, new[]
                {
                    $"Hello {user.FirstName},",
                    "",
                    "Someone asked to reset the password for your Student Survey System account.",
                    "Open this link to choose a new one:",
                    "",
                    link,
                    "",
                    $"The link works once and expires in {minutes} minutes.",
                    "If this was not you, you can ignore this message - your password stays as it is.",
                    ""
                });

                try
                {
                    await _email.SendAsync(user.Email, "Reset your Student Survey System password", body);
                }
                catch (Exception exception)
                {
                    // Still answer neutrally: telling the caller that sending failed
                    // would confirm the address exists.
                    _logger.LogError(exception, "Could not send a password reset email.");
                }
            }

            return Ok(new { message = NeutralMessage });
        }

        /// <summary>
        /// Finishes a reset by redeeming the token from the emailed link.
        /// Every kind of bad token gives the same answer.
        /// </summary>
        [HttpPost("password-reset/confirm")]
        public async Task<ActionResult> ConfirmPasswordReset([FromBody] PasswordResetConfirmRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { message = "This reset link is invalid or has expired." });
            }

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            {
                return BadRequest(new { message = "Password must be at least 8 characters" });
            }

            var redeemed = await _passwordResets.RedeemTokenAsync(request.Token, request.Password);

            if (!redeemed)
            {
                return BadRequest(new { message = "This reset link is invalid or has expired." });
            }

            return Ok(new { message = "Your password has been changed. You can now sign in." });
        }

        private object BuildSession(UserAccount user)
        {
            var (token, expiresAt) = _tokens.CreateToken(user);

            return new
            {
                token,
                expiresAt,
                user = UserPresentation.ToDto(user)
            };
        }
    }
}
