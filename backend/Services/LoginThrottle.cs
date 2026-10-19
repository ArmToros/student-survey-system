using Microsoft.Extensions.Caching.Memory;

namespace backend.Services;

/// <summary>
/// Per-account sign-in lockout, on top of the per-IP rate limit in Program.cs.
/// The rate limiter stops one machine hammering the endpoint; this stops a
/// password being guessed for one account from many machines.
///
/// Attempts are counted against the submitted email whether or not an account
/// with that address exists, so a locked response reveals nothing about which
/// accounts are real.
///
/// State lives in memory, which means it resets when the backend restarts and is
/// not shared between instances. A deployment behind more than one instance needs
/// a shared store (the obvious options are Redis or a table, and a table would be
/// a schema change).
/// </summary>
public class LoginThrottle
{
    /// <summary>Name of the per-IP rate limit policy applied to the auth endpoints.</summary>
    public const string RateLimitPolicy = "auth";

    /// <summary>Failures allowed inside <see cref="FailureWindow"/> before locking.</summary>
    public const int MaxFailedAttempts = 5;

    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private readonly IMemoryCache _cache;

    public LoginThrottle(IMemoryCache cache)
    {
        _cache = cache;
    }

    /// <summary>How much longer this account stays locked, or null if it is not locked.</summary>
    public TimeSpan? GetLockoutRemaining(string? identifier)
    {
        var key = Normalize(identifier);
        if (key == null)
        {
            return null;
        }

        if (!_cache.TryGetValue(LockKey(key), out DateTimeOffset lockedUntil))
        {
            return null;
        }

        var remaining = lockedUntil - DateTimeOffset.UtcNow;
        return remaining > TimeSpan.Zero ? remaining : null;
    }

    public void RecordFailure(string? identifier)
    {
        var key = Normalize(identifier);
        if (key == null)
        {
            return;
        }

        _cache.TryGetValue(FailureKey(key), out int failures);
        failures++;

        if (failures >= MaxFailedAttempts)
        {
            _cache.Set(LockKey(key), DateTimeOffset.UtcNow.Add(LockoutDuration), LockoutDuration);
            _cache.Remove(FailureKey(key));
            return;
        }

        // The window slides forward only on a new failure, not on a quiet period.
        _cache.Set(FailureKey(key), failures, FailureWindow);
    }

    public void RecordSuccess(string? identifier)
    {
        var key = Normalize(identifier);
        if (key == null)
        {
            return;
        }

        _cache.Remove(FailureKey(key));
        _cache.Remove(LockKey(key));
    }

    private static string FailureKey(string key) => "login-failures:" + key;

    private static string LockKey(string key) => "login-lock:" + key;

    private static string? Normalize(string? identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return null;
        }

        return identifier.Trim().ToLowerInvariant();
    }
}
