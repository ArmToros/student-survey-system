using System.Security.Cryptography;
using System.Text;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

/// <summary>
/// Issues and redeems password reset tokens.
///
/// A token is 32 random bytes, handed to the user in a link and stored only as
/// its SHA-256 hash. Because the token is high-entropy random, a plain SHA-256 is
/// enough here - unlike a password, it cannot be guessed from a dictionary.
///
/// Requesting a reset invalidates whatever the account had outstanding, so only
/// the newest link works, and redeeming one stamps UsedAt so it cannot be
/// replayed.
/// </summary>
public class PasswordResetService
{
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);

    private readonly SssContext _context;
    private readonly PasswordSecurity _passwords;

    public PasswordResetService(SssContext context, PasswordSecurity passwords)
    {
        _context = context;
        _passwords = passwords;
    }

    /// <summary>
    /// Creates a token for the account and returns the value to put in the link.
    /// The caller is responsible for only ever sending it to that account.
    /// </summary>
    public async Task<string> IssueTokenAsync(UserAccount user, CancellationToken cancellationToken = default)
    {
        var outstanding = await _context.PasswordResetTokens
            .Where(token => token.UserId == user.Id && token.UsedAt == null)
            .ToListAsync(cancellationToken);

        // Asking again replaces any earlier link.
        var now = DateTime.UtcNow;
        foreach (var token in outstanding)
        {
            token.UsedAt = now;
        }

        var rawToken = CreateRawToken();

        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawToken),
            ExpiresAt = now.Add(TokenLifetime)
        });

        await _context.SaveChangesAsync(cancellationToken);

        return rawToken;
    }

    /// <summary>
    /// Sets a new password if the token is valid, unused and unexpired.
    /// Returns false for every kind of bad token, so the caller cannot
    /// accidentally tell the user which part was wrong.
    /// </summary>
    public async Task<bool> RedeemTokenAsync(
        string rawToken,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawToken) || string.IsNullOrWhiteSpace(newPassword))
        {
            return false;
        }

        var hash = HashToken(rawToken);

        var token = await _context.PasswordResetTokens
            .Include(item => item.User)
            .FirstOrDefaultAsync(item => item.TokenHash == hash, cancellationToken);

        if (token == null || token.UsedAt != null || token.ExpiresAt <= DateTime.UtcNow)
        {
            return false;
        }

        token.User.PasswordHash = _passwords.Hash(newPassword);
        token.UsedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }

    /// <summary>Removes tokens that are spent or long expired.</summary>
    public async Task<int> PurgeExpiredAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow.Subtract(TimeSpan.FromDays(7));

        var stale = await _context.PasswordResetTokens
            .Where(token => token.ExpiresAt < cutoff)
            .ToListAsync(cancellationToken);

        if (stale.Count == 0)
        {
            return 0;
        }

        _context.PasswordResetTokens.RemoveRange(stale);
        await _context.SaveChangesAsync(cancellationToken);

        return stale.Count;
    }

    /// <summary>URL-safe base64 of 32 random bytes.</summary>
    private static string CreateRawToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static string HashToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }
}
