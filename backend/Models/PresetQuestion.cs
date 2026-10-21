using System;

namespace backend.Models;

/// <summary>
/// A common question with a ready-made answer, maintained by admins:
/// dbo.PresetQuestion.
///
/// Picking one of these shows its answer immediately and starts no
/// conversation. Only questions that are not on the list go to an admin, as a
/// dbo.Chat opened through "Other".
/// </summary>
public partial class PresetQuestion
{
    public int Id { get; set; }

    public string Question { get; set; } = null!;

    public string Answer { get; set; } = null!;

    /// <summary>Lower sorts first; ties fall back to the question text.</summary>
    public int SortOrder { get; set; }

    /// <summary>Retired questions keep their wording but leave the list.</summary>
    public bool IsActive { get; set; }

    public int? CreatedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
