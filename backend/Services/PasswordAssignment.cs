using System.Security.Cryptography;
using System.Text;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Services;

/// <summary>
/// Replaces every account password with a freshly generated strong one.
///
/// The placeholder passwords the backup ships with ("hash_admin_1" and the rest)
/// are written down in README.md, so they are only safe while the app is reachable
/// from localhost alone. Anything published more widely needs real passwords.
///
/// The new passwords are written to a file - never to the console or the log -
/// because they cannot be recovered from the database afterwards: only their
/// PBKDF2 hashes are stored. Keep that file somewhere safe or put the passwords
/// in a password manager and delete it.
///
/// "npm run db:restore" puts the placeholder passwords back, so re-run this
/// afterwards if the app is still published.
///
/// Run with:
///     dotnet run --project backend/backend.csproj -- set-passwords [output-file]
/// </summary>
public static class PasswordAssignment
{
    /// <summary>
    /// Omits characters that are easy to confuse when typed from a phone:
    /// 0/O, 1/l/I, and anything a shell would need escaping for.
    /// </summary>
    private const string Alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private const int PasswordLength = 20;

    public static async Task<int> RunAsync(IServiceProvider services, string outputPath)
    {
        using var scope = services.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<SssContext>();
        var passwords = scope.ServiceProvider.GetRequiredService<PasswordSecurity>();

        if (!await context.Database.CanConnectAsync())
        {
            Console.Error.WriteLine("Cannot reach the SSS database. Run 'npm run db:restore' first.");
            return 1;
        }

        var users = await context.UserAccounts
            .OrderBy(user => user.Id)
            .ToListAsync();

        var written = new StringBuilder();
        written.AppendLine("# Student Survey System - account passwords");
        written.AppendLine($"# Generated {DateTime.Now:yyyy-MM-dd HH:mm}. These replace the placeholders in README.md.");
        written.AppendLine("# Only the hashes are in the database, so this file is the only copy.");
        written.AppendLine("# 'npm run db:restore' reverts to the placeholders and invalidates all of these.");
        written.AppendLine();

        var changed = 0;
        var skipped = 0;

        foreach (var user in users)
        {
            if (string.IsNullOrWhiteSpace(user.Email))
            {
                skipped++;
                continue;
            }

            var password = Generate();
            user.PasswordHash = passwords.Hash(password);

            var role = string.IsNullOrWhiteSpace(user.Role) ? "-" : user.Role;
            written.AppendLine($"{role}\t{user.Email}\t{password}");
            changed++;
        }

        if (changed > 0)
        {
            await context.SaveChangesAsync();
            await File.WriteAllTextAsync(outputPath, written.ToString());
        }

        Console.WriteLine($"Accounts checked:   {users.Count}");
        Console.WriteLine($"Passwords replaced: {changed}");
        Console.WriteLine($"Skipped (no email): {skipped}");
        Console.WriteLine();
        Console.WriteLine($"New passwords written to: {Path.GetFullPath(outputPath)}");
        Console.WriteLine("That file is the only copy - store it safely, then delete it.");

        return 0;
    }

    private static string Generate()
    {
        var characters = new char[PasswordLength];
        for (var index = 0; index < characters.Length; index++)
        {
            characters[index] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new string(characters);
    }
}
