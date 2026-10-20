using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// One user's run through one survey: dbo.SurveySession (ID identity, SurveyID, UserID).
/// A session groups the rows that user wrote into dbo.SurveyAnswer.
/// </summary>
public partial class SurveySession
{
    public int Id { get; set; }

    public int SurveyId { get; set; }

    public int UserId { get; set; }

    /// <summary>When the response was submitted. Null on rows from the backup.</summary>
    public DateTime? SubmittedAt { get; set; }

    public virtual Survey Survey { get; set; } = null!;

    public virtual UserAccount User { get; set; } = null!;

    public virtual ICollection<SurveyAnswer> SurveyAnswers { get; set; } = new List<SurveyAnswer>();
}
