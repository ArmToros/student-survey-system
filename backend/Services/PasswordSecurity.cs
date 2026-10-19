using Microsoft.AspNetCore.Identity;

namespace backend.Services;

/// <summary>
/// Hashes and verifies account passwords with ASP.NET Core's PBKDF2 hasher.
///
/// The restored database stores plain-text placeholders (for example
/// "hash_admin_1") in UserAccount.PasswordHash. <see cref="Check"/> recognises a
/// value that is not a hash, verifies it as plain text, and reports
/// <see cref="PasswordCheckResult.ValidNeedsUpgrade"/> so the caller can replace
/// it with a real hash on the spot. That makes the switch safe whether or not
/// scripts have been run, and the database upgrades itself as people sign in.
///
/// Once every row is hashed, the plain-text branch can be deleted.
/// </summary>
public class PasswordSecurity
{
    private static readonly object HasherUser = new();

    private readonly PasswordHasher<object> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(HasherUser, password);

    /// <summary>
    /// True when the stored value is an ASP.NET Core identity hash rather than a
    /// plain-text placeholder. Those hashes are base64 whose first byte is a
    /// format marker of 0x00 (v2) or 0x01 (v3).
    /// </summary>
    public static bool LooksHashed(string? storedValue)
    {
        if (string.IsNullOrWhiteSpace(storedValue))
        {
            return false;
        }

        var buffer = new byte[storedValue.Length];
        if (!Convert.TryFromBase64String(storedValue, buffer, out var written))
        {
            return false;
        }

        return written >= 13 && (buffer[0] == 0x00 || buffer[0] == 0x01);
    }

    public PasswordCheckResult Check(string? storedValue, string password)
    {
        if (string.IsNullOrEmpty(storedValue) || string.IsNullOrEmpty(password))
        {
            return PasswordCheckResult.Failed;
        }

        if (!LooksHashed(storedValue))
        {
            // Legacy row: the stored value is the password itself.
            return string.Equals(storedValue, password, StringComparison.Ordinal)
                ? PasswordCheckResult.ValidNeedsUpgrade
                : PasswordCheckResult.Failed;
        }

        return _hasher.VerifyHashedPassword(HasherUser, storedValue, password) switch
        {
            PasswordVerificationResult.Success => PasswordCheckResult.Valid,
            PasswordVerificationResult.SuccessRehashNeeded => PasswordCheckResult.ValidNeedsUpgrade,
            _ => PasswordCheckResult.Failed
        };
    }
}

public enum PasswordCheckResult
{
    Failed,
    Valid,
    ValidNeedsUpgrade
}
