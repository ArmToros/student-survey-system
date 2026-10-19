using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend.Models;
using Microsoft.IdentityModel.Tokens;

namespace backend.Services;

/// <summary>
/// Issues the signed access tokens returned by login and registration.
/// The role claim carries the normalised lowercase role ("admin"), which is what
/// the authorization policies in Program.cs and the React app both expect.
/// </summary>
public class JwtTokenService
{
    public const string Issuer = "student-survey-system";
    public const string Audience = "student-survey-system";

    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);

    private readonly SymmetricSecurityKey _signingKey;

    public JwtTokenService(JwtSigningKey signingKey)
    {
        _signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey.Value));
    }

    public (string Token, DateTime ExpiresAt) CreateToken(UserAccount user)
    {
        var role = UserPresentation.ToRole(user.Role);
        var expiresAt = DateTime.UtcNow.Add(Lifetime);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Role, role)
        };

        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            claims.Add(new Claim(ClaimTypes.Email, user.Email));
        }

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}

/// <summary>
/// The HMAC signing key, resolved once at startup so a missing key fails loudly
/// instead of silently issuing tokens nobody can validate.
/// </summary>
public sealed class JwtSigningKey
{
    public JwtSigningKey(string value)
    {
        // HS256 needs at least 256 bits of key material.
        if (string.IsNullOrWhiteSpace(value) || Encoding.UTF8.GetByteCount(value) < 32)
        {
            throw new InvalidOperationException(
                "JWT_SIGNING_KEY must be set to at least 32 characters. Add it to the .env file at the repository root.");
        }

        Value = value;
    }

    public string Value { get; }
}
