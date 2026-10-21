using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// A survey in the SSS database: dbo.Survey.
/// Category, CreatedAt, ClosedAt and IsClosed were added by
/// scripts/schema-authoring.sql, and Deadline by
/// scripts/schema-survey-deadline.sql; surveys restored from the backup have
/// the dates null and IsClosed false.
/// </summary>
public partial class Survey
{
    public int SurveyId { get; set; }

    public int CreatedBy { get; set; }

    public string? Topic { get; set; }

    public string? Category { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    /// <summary>
    /// When the survey stops taking answers, or null for "until somebody closes
    /// it". Added by scripts/schema-survey-deadline.sql; surveys restored from
    /// the backup have none.
    /// </summary>
    public DateTime? Deadline { get; set; }

    public bool IsClosed { get; set; }

    public virtual UserAccount CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Question> Questions { get; set; } = new List<Question>();

    public virtual ICollection<SurveySession> SurveySessions { get; set; } = new List<SurveySession>();

    /// <summary>Roles this survey is aimed at. Empty means everyone.</summary>
    public virtual ICollection<SurveyTargetRole> TargetRoles { get; set; } = new List<SurveyTargetRole>();
}
