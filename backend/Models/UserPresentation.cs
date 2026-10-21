using System.Text.Json;
using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// Translates between how the database stores a user account and what the React
/// app expects.
///
/// The restored database stores display-style values - Role "Admin", Theme "Light",
/// Language "Armenian" - while the frontend compares against lowercase role names
/// ('admin'), lowercase themes ('light') and i18n codes ('en', 'ru', 'am'). Without
/// this translation the admin and lecturer routes reject their own users, because
/// ProtectedRoute checks allowedRoles={['admin']}.
///
/// The conversion happens in the API so the database is left exactly as restored.
/// </summary>
public static class UserPresentation
{
    private static readonly Dictionary<string, string> LanguageToCode = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Armenian"] = "am",
        ["English"] = "en",
        ["Russian"] = "ru",
    };

    private static readonly Dictionary<string, string> CodeToLanguage = new(StringComparer.OrdinalIgnoreCase)
    {
        ["am"] = "Armenian",
        ["en"] = "English",
        ["ru"] = "Russian",
    };

    /// <summary>The API shape of a user account, used by both login and the account page.</summary>
    public static object ToDto(UserAccount user)
    {
        var role = ToRole(user.Role);

        return new
        {
            dbId = user.Id,
            id = "user-" + role + "-" + user.Id,
            role,
            roleLabel = ToRoleLabel(role),
            firstName = user.FirstName,
            lastName = user.LastName,
            middleName = user.MiddleName,
            email = user.Email,
            phone = user.Phone,
            address = user.Address,
            language = ToLanguageCode(user.Language),
            theme = ToTheme(user.Theme),
            avatar = user.PhotoUrl,
            joinDate = user.JoinDate,
            studentId = user.StudentDatum?.StudentId,
            major = user.StudentDatum?.Major,
            degree = user.StudentDatum?.Degree,
            academicYear = ToAcademicYear(user.StudentDatum),
            startYear = user.StudentDatum?.StartYear,
            department = user.LecturerDatum?.Department,
            preferences = ToPreferences(user.Preferences)
        };
    }

    /// <summary>
    /// The stored preferences document, as an object rather than a string, so the
    /// client reads it like any other field. Anything unparseable is treated as
    /// "no preferences saved yet" rather than failing the whole request.
    /// </summary>
    public static JsonElement? ToPreferences(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(stored);
            return document.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Which year of their degree a student is in, counted from the September
    /// they started: 2023 means year 1 in 2023/24, year 2 in 2024/25 and so on.
    ///
    /// Working it out on every read is what makes it roll over on 1 September
    /// without anything having to run that day. A row with no StartYear falls
    /// back to the stored AcademicYear, which is the best that can be said about
    /// it.
    /// </summary>
    public static int? ToAcademicYear(StudentDatum? student, DateTime? asOf = null)
    {
        if (student == null)
        {
            return null;
        }

        if (student.StartYear == null)
        {
            return student.AcademicYear;
        }

        var today = asOf ?? DateTime.Today;

        // The academic year turns over on 1 September, so anything before that
        // still belongs to the year that began the previous September.
        var currentIntake = today.Month >= 9 ? today.Year : today.Year - 1;
        var year = currentIntake - student.StartYear.Value + 1;

        return year < 1 ? 1 : year;
    }

    /// <summary>"Admin" -> "admin"; anything unrecognised falls back to "student".</summary>
    public static string ToRole(string? storedRole)
    {
        var role = storedRole?.Trim().ToLowerInvariant();

        return role switch
        {
            "admin" or "lecturer" or "student" => role,
            _ => "student"
        };
    }

    public static string ToRoleLabel(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return "Student";
        }

        return char.ToUpperInvariant(role[0]) + role[1..];
    }

    /// <summary>"Light" -> "light"; anything unrecognised falls back to "light".</summary>
    public static string ToTheme(string? storedTheme)
    {
        var theme = storedTheme?.Trim().ToLowerInvariant();

        return theme == "dark" ? "dark" : "light";
    }

    /// <summary>"Armenian" -> "am". An already-valid code is passed through.</summary>
    public static string ToLanguageCode(string? storedLanguage)
    {
        var language = storedLanguage?.Trim();

        if (string.IsNullOrWhiteSpace(language))
        {
            return "en";
        }

        if (LanguageToCode.TryGetValue(language, out var code))
        {
            return code;
        }

        return CodeToLanguage.ContainsKey(language) ? language.ToLowerInvariant() : "en";
    }

    /// <summary>"am" -> "Armenian", so saved settings keep the database's own convention.</summary>
    public static string? ToStoredLanguage(string? incomingLanguage)
    {
        var language = incomingLanguage?.Trim();

        if (string.IsNullOrWhiteSpace(language))
        {
            return null;
        }

        if (CodeToLanguage.TryGetValue(language, out var stored))
        {
            return stored;
        }

        return LanguageToCode.ContainsKey(language) ? language : null;
    }

    /// <summary>"dark" -> "Dark", matching the stored capitalisation.</summary>
    public static string? ToStoredTheme(string? incomingTheme)
    {
        var theme = incomingTheme?.Trim().ToLowerInvariant();

        return theme switch
        {
            "dark" => "Dark",
            "light" => "Light",
            _ => null
        };
    }
}
