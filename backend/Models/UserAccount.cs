using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class UserAccount
{
    public int Id { get; set; }

    public string? Role { get; set; }

    public string? FirstName { get; set; }

    public string? LastName { get; set; }

    public string? MiddleName { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? PasswordHash { get; set; }

    public string? Language { get; set; }

    public string? Theme { get; set; }

    /// <summary>When the account was created. Null on rows from the backup.</summary>
    public DateTime? JoinDate { get; set; }

    /// <summary>Path or URL of the profile picture, if one has been set.</summary>
    public string? PhotoUrl { get; set; }

    public virtual LecturerDatum? LecturerDatum { get; set; }

    public virtual StudentDatum? StudentDatum { get; set; }

    public virtual ICollection<News> News { get; set; } = new List<News>();

    public virtual ICollection<Chat> ChatAssignedAdminNavigations { get; set; } = new List<Chat>();

    public virtual ICollection<Chat> ChatCreatedByNavigations { get; set; } = new List<Chat>();

    public virtual ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();

    public virtual ICollection<Survey> SurveysCreated { get; set; } = new List<Survey>();

    public virtual ICollection<SurveySession> SurveySessions { get; set; } = new List<SurveySession>();

    public virtual ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
}
