using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Services;

/// <summary>
/// Replaces the plain-text values in UserAccount.PasswordHash with PBKDF2 hashes.
///
/// Each password keeps its current value, so everyone signs in with exactly the
/// credentials they used before - "hash_admin_1" stays "hash_admin_1", it is just
/// no longer readable in the database.
///
/// Safe to re-run: rows that already hold a hash are skipped. To undo it, restore
/// the database again with "npm run db:restore".
///
/// Run with:
///     dotnet run --project backend/backend.csproj -- migrate-passwords
/// </summary>
public static class PasswordMigration
{
    public static async Task<int> RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<SssContext>();
        var passwords = scope.ServiceProvider.GetRequiredService<PasswordSecurity>();

        if (!await context.Database.CanConnectAsync())
        {
            Console.Error.WriteLine("Cannot reach the SSS database. Run 'npm run db:restore' first.");
            return 1;
        }

        var users = await context.UserAccounts.ToListAsync();

        var hashed = 0;
        var alreadyHashed = 0;
        var empty = 0;

        foreach (var user in users)
        {
            if (string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                empty++;
                continue;
            }

            if (PasswordSecurity.LooksHashed(user.PasswordHash))
            {
                alreadyHashed++;
                continue;
            }

            user.PasswordHash = passwords.Hash(user.PasswordHash);
            hashed++;
        }

        if (hashed > 0)
        {
            await context.SaveChangesAsync();
        }

        Console.WriteLine($"Accounts checked:   {users.Count}");
        Console.WriteLine($"Newly hashed:       {hashed}");
        Console.WriteLine($"Already hashed:     {alreadyHashed}");
        Console.WriteLine($"No password set:    {empty}");

        if (hashed > 0)
        {
            Console.WriteLine();
            Console.WriteLine("Passwords are unchanged - only their storage is. Sign in exactly as before.");
        }

        return 0;
    }
}
