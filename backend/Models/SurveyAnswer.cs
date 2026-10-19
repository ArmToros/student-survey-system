using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// A single answer: dbo.SurveyAnswer (ID identity, SessionID, QuestionID, Answer).
/// Answers are stored as free text; the existing rows hold Likert values such as
/// "Strongly Agree" or "Very Satisfied".
/// </summary>
public partial class SurveyAnswer
{
    public int Id { get; set; }

    public int SessionId { get; set; }

    public int QuestionId { get; set; }

    public string? Answer { get; set; }

    public virtual Question Question { get; set; } = null!;

    public virtual SurveySession Session { get; set; } = null!;
}
