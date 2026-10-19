using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// A survey in the restored SSS database: dbo.Survey (SurveyID, CreatedBy, Topic).
/// Note this table carries no status or created date, so the API reports every
/// survey as active and leaves dates null.
/// </summary>
public partial class Survey
{
    public int SurveyId { get; set; }

    public int CreatedBy { get; set; }

    public string? Topic { get; set; }

    public virtual UserAccount CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Question> Questions { get; set; } = new List<Question>();

    public virtual ICollection<SurveySession> SurveySessions { get; set; } = new List<SurveySession>();
}
