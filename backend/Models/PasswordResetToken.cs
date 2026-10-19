using System;

namespace backend.Models;

/// <summary>
/// A single-use password reset token: dbo.PasswordResetToken.
///
/// Created by scripts/schema-password-reset-token.sql, which both restore paths
/// apply, because the table does not exist in the backup.
///
/// <see cref="TokenHash"/> holds the SHA-256 of the token, never the token
/// itself, so this table cannot be read back into working reset links. A token is
/// usable once: <see cref="UsedAt"/> is stamped when it is redeemed.
/// </summary>
public partial class PasswordResetToken
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string TokenHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public virtual UserAccount User { get; set; } = null!;
}
