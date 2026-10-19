namespace backend.Services;

/// <summary>
/// Where the React app lives, so the backend can build links that point at it
/// rather than at its own address. Set APP_BASE_URL to override; it otherwise
/// follows the first entry in CORS_ALLOWED_ORIGINS.
/// </summary>
public sealed class AppUrls
{
    public AppUrls(string baseUrl)
    {
        BaseUrl = baseUrl.TrimEnd('/');
    }

    public string BaseUrl { get; }

    public string PasswordResetLink(string token) =>
        $"{BaseUrl}/reset-password?token={Uri.EscapeDataString(token)}";
}
