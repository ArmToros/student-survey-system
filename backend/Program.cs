using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// Docker compose passes OPENAI_API_KEY, the signing key and the connection string
// as environment variables, but "dotnet run" does not read the .env file at the
// repository root, so load it here too. Variables already set in the environment
// always win, and a missing .env is fine.
LoadDotEnvFile();

// "dotnet run --project backend/backend.csproj -- migrate-passwords" hashes the
// plain-text passwords still in the database instead of starting the server.
const string MigratePasswordsCommand = "migrate-passwords";
const string SetPasswordsCommand = "set-passwords";
var runPasswordMigration = args.Contains(MigratePasswordsCommand);
var runPasswordAssignment = args.Contains(SetPasswordsCommand);

// "set-passwords" takes an optional output path; anything that is not a command
// name is treated as that path.
var passwordOutputPath = args
    .FirstOrDefault(argument => argument != MigratePasswordsCommand && argument != SetPasswordsCommand)
    ?? "credentials.local.txt";

var hostArgs = args
    .Where(argument => argument != MigratePasswordsCommand && argument != SetPasswordsCommand)
    .ToArray();

var builder = WebApplication.CreateBuilder(hostArgs);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();

builder.Services.AddSwaggerGen(options =>
{
    // Lets the Swagger UI send the bearer token from POST /api/auth/login.
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token returned by /api/auth/login."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Only the listed browser origins may call the API. Set CORS_ALLOWED_ORIGINS to a
// comma separated list; it defaults to the React dev server.
var allowedOrigins = (builder.Configuration["CORS_ALLOWED_ORIGINS"] ?? "http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyMethod()
        .AllowAnyHeader());
});

// Per-IP throttle for the sign-in endpoints. The account lockout in
// LoginThrottle sits on top of this and is keyed by email instead.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy(LoginThrottle.RateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            // Behind a reverse proxy this is the proxy address unless forwarded
            // headers are configured, so the limit would then apply to everyone.
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString();
        }

        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"message\":\"Too many attempts. Please wait a moment and try again.\"}",
            cancellationToken);
    };
});

builder.Services.AddMemoryCache();
builder.Services.AddSingleton<LoginThrottle>();

// Mail, and the base URL the reset link points at. APP_BASE_URL defaults to the
// first allowed CORS origin, which is the React app in every normal setup.
builder.Services.AddSingleton(SmtpOptions.FromConfiguration(builder.Configuration));
builder.Services.AddSingleton<IEmailSender, EmailSender>();
builder.Services.AddSingleton(new AppUrls(
    string.IsNullOrWhiteSpace(builder.Configuration["APP_BASE_URL"])
        ? allowedOrigins.FirstOrDefault() ?? "http://localhost:3000"
        : builder.Configuration["APP_BASE_URL"]!));
builder.Services.AddScoped<PasswordResetService>();

var signingKey = new JwtSigningKey(ResolveSigningKey(builder));

builder.Services.AddSingleton(signingKey);
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<PasswordSecurity>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = JwtTokenService.Issuer,
            ValidateAudience = true,
            ValidAudience = JwtTokenService.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey.Value)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.NameIdentifier
        };
    });

builder.Services.AddAuthorization(options =>
{
    // Every endpoint needs a signed-in caller unless it opts out with [AllowAnonymous].
    options.FallbackPolicy = null;
    options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy("Staff", policy => policy.RequireRole("admin", "lecturer"));
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("admin"));
});

builder.Services.AddDbContext<SssContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

if (runPasswordMigration)
{
    return await PasswordMigration.RunAsync(app.Services);
}

if (runPasswordAssignment)
{
    return await PasswordAssignment.RunAsync(app.Services, passwordOutputPath);
}

// The app is reached through nginx on the VPS, so every request arrives from
// the proxy's Tailscale address. Without this, the login rate limiter keys on
// that one address and its ten attempts a minute are shared by everybody -
// one tester signing in locks the rest out with a 429.
//
// Only the proxy is trusted to speak for its clients, and the forwarded list
// is cleared first so a header invented by a caller cannot be believed. The
// address comes from TRUSTED_PROXY so a different proxy does not need a code
// change; with nothing set, nothing is trusted and behaviour is unchanged.
var trustedProxy = builder.Configuration["TRUSTED_PROXY"];
if (!string.IsNullOrWhiteSpace(trustedProxy)
    && System.Net.IPAddress.TryParse(trustedProxy.Trim(), out var proxyAddress))
{
    var forwarding = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        ForwardLimit = 1
    };

    forwarding.KnownNetworks.Clear();
    forwarding.KnownProxies.Clear();
    forwarding.KnownProxies.Add(proxyAddress);

    app.UseForwardedHeaders(forwarding);
}

if (app.Environment.IsDevelopment())
{
    // Both of these are developer tools and neither belongs on a published URL:
    // the exception page prints stack traces and configuration, and Swagger maps
    // out the whole API. Outside Development the handler below answers instead.
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Without this an unhandled exception returns an empty 500, which the React
    // app cannot report usefully. The detail goes to the log, never to the client.
    app.UseExceptionHandler(branch => branch.Run(async context =>
    {
        var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogError(error, "Unhandled exception for {Method} {Path}",
            context.Request.Method, context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            message = "Something went wrong. Please try again."
        });
    }));
}

app.UseCors("Frontend");

// When "npm run build" has produced a frontend bundle, serve it from the same
// origin as the API. getApiBaseUrl() in src/services/api.js then falls back to
// relative URLs, so one build works on any hostname - localhost, a Tailscale
// name, a server - without being rebuilt or needing a CORS entry.
var frontendBuildPath = Environment.GetEnvironmentVariable("FRONTEND_BUILD_PATH")
    ?? Path.Combine(app.Environment.ContentRootPath, "..", "build");

var frontendBuildExists = Directory.Exists(frontendBuildPath);
IFileProvider? frontendFiles = frontendBuildExists
    ? new PhysicalFileProvider(Path.GetFullPath(frontendBuildPath))
    : null;

if (frontendFiles != null)
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = frontendFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = frontendFiles });
}

// Uploaded profile pictures. They live on disk rather than in the database, so
// restoring the SSS backup leaves them alone. The folder is created on the
// first upload, and is git-ignored.
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads",
    // Only the handful of image types the upload endpoint accepts are served,
    // so an unexpected file in that folder is not handed out as anything.
    ServeUnknownFileTypes = false
});

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

if (frontendFiles != null)
{
    // Client-side routes (/surveys/2, /admin, ...) are not files on disk, so
    // anything the API did not handle falls back to the React entry point.
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = frontendFiles });
}

app.Run();
return 0;

static string ResolveSigningKey(WebApplicationBuilder builder)
{
    var configured = builder.Configuration["JWT_SIGNING_KEY"]
        ?? builder.Configuration["Jwt:SigningKey"];

    if (!string.IsNullOrWhiteSpace(configured))
    {
        return configured;
    }

    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "JWT_SIGNING_KEY is not set. Set it as an environment variable before starting the backend.");
    }

    // Development convenience: a throwaway key so a fresh clone starts without
    // setup. Tokens stop working on restart, so .env should supply a real one.
    var generated = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    Console.WriteLine("WARNING: JWT_SIGNING_KEY is not set. Using a temporary key; " +
                      "tokens will be invalidated when the backend restarts. Add JWT_SIGNING_KEY to .env.");
    return generated;
}

static void LoadDotEnvFile()
{
    // Walk up from the working directory so this works whether the app is started
    // from the repository root or from the backend folder.
    var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

    while (directory != null)
    {
        var candidate = Path.Combine(directory.FullName, ".env");

        if (File.Exists(candidate))
        {
            foreach (var rawLine in File.ReadAllLines(candidate))
            {
                var line = rawLine.Trim();

                if (line.Length == 0 || line.StartsWith('#'))
                {
                    continue;
                }

                var separator = line.IndexOf('=');
                if (separator <= 0)
                {
                    continue;
                }

                var key = line[..separator].Trim();
                var value = line[(separator + 1)..].Trim().Trim('"');

                if (key.Length == 0 || value.Length == 0)
                {
                    continue;
                }

                // Never override a value the environment already provides.
                if (Environment.GetEnvironmentVariable(key) == null)
                {
                    Environment.SetEnvironmentVariable(key, value);
                }
            }

            return;
        }

        directory = directory.Parent;
    }
}
