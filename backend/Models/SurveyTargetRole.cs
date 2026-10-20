namespace backend.Models;

/// <summary>
/// One role a survey is aimed at: dbo.SurveyTargetRole.
///
/// Shaped like dbo.NewsTargetRole, which the backup already had, so the two
/// features behave the same way. A survey with no rows here is for everyone -
/// that is what lets the surveys already in the database stay visible.
/// </summary>
public partial class SurveyTargetRole
{
    public int SurveyId { get; set; }

    /// <summary>Admin, Lecturer or Student.</summary>
    public string Role { get; set; } = null!;

    public virtual Survey Survey { get; set; } = null!;
}
