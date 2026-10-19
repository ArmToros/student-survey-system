using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// A survey question: dbo.Question (QuestionID, SurveyID, Answear).
///
/// The table has no column for the question text, no type and no answer options.
/// "Answear" (the spelling is the database's) is the only text column, so the API
/// uses it as the question label and derives the answer options from the values
/// already recorded in dbo.SurveyAnswer. scripts/migrate-question-text.sql adds
/// proper columns, but it is deliberately left unapplied.
/// </summary>
public partial class Question
{
    public int QuestionId { get; set; }

    public string? Answear { get; set; }

    public int? SurveyId { get; set; }

    public virtual Survey? Survey { get; set; }

    public virtual ICollection<SurveyAnswer> SurveyAnswers { get; set; } = new List<SurveyAnswer>();
}
