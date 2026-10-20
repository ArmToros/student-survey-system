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
    /// Three short words and two digits, joined by hyphens - "copper-harbor-mint-47".
    /// These get read out over the phone and typed on a keyboard that may be set
    /// to a different layout, so a random string of twenty characters is the wrong
    /// shape: people mistype it, then report a broken login.
    ///
    /// The words avoid anything that reads differently when spoken, and the list
    /// is long enough that three of them plus two digits gives roughly 10^9
    /// combinations - fine behind a rate-limited login, not a substitute for a
    /// password the holder has chosen themselves.
    /// </summary>
    private static readonly string[] Words =
    {
        "amber", "anchor", "apple", "arrow", "aspen", "autumn", "basil", "beacon",
        "birch", "bishop", "bramble", "branch", "bridge", "bronze", "butter", "canyon",
        "cedar", "chalk", "cherry", "chisel", "cinder", "citrus", "clover", "cobalt",
        "compass", "copper", "coral", "cotton", "crater", "cricket", "crimson", "crystal",
        "dahlia", "daisy", "damson", "delta", "domino", "dragon", "driftwood", "ember",
        "falcon", "fennel", "fern", "fiddle", "flint", "forest", "fossil", "garnet",
        "ginger", "glacier", "granite", "harbor", "harvest", "hazel", "heather", "hollow",
        "indigo", "island", "ivory", "jasmine", "juniper", "kestrel", "lantern", "lemon",
        "lilac", "linen", "lobster", "lotus", "magnet", "mahogany", "maple", "marble",
        "meadow", "mercury", "mint", "monsoon", "mosaic", "mulberry", "nectar", "nutmeg",
        "oakwood", "olive", "onyx", "opal", "orchard", "osprey", "otter", "paprika",
        "pebble", "pelican", "pepper", "pewter", "pigeon", "pine", "plover", "plum",
        "pollen", "poppy", "prairie", "quartz", "quince", "rabbit", "raven", "ribbon",
        "river", "rosemary", "rowan", "saffron", "sage", "salmon", "sandal", "sapphire",
        "scarlet", "seagull", "sequoia", "shadow", "shale", "sierra", "silver", "sorrel",
        "sparrow", "spruce", "starling", "sugar", "sumac", "summit", "sunset", "sycamore",
        "tangerine", "teal", "thistle", "thunder", "timber", "topaz", "tulip", "tundra",
        "turnip", "umber", "valley", "velvet", "vermilion", "vinegar", "violet", "walnut",
        "willow", "windmill", "winter", "wombat", "yarrow", "yellow", "zephyr", "zinnia"
    };

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
        var first = Words[RandomNumberGenerator.GetInt32(Words.Length)];

        string second;
        do
        {
            second = Words[RandomNumberGenerator.GetInt32(Words.Length)];
        }
        while (second == first);

        string third;
        do
        {
            third = Words[RandomNumberGenerator.GetInt32(Words.Length)];
        }
        while (third == first || third == second);

        // Two digits, never leading zero, so nothing is lost when the password
        // is pasted into a spreadsheet cell on the way to whoever needs it.
        var digits = RandomNumberGenerator.GetInt32(10, 100);

        return $"{first}-{second}-{third}-{digits}";
    }
}
