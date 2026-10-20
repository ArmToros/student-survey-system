using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// A survey question: dbo.Question (QuestionID, SurveyID, Answear).
///
/// "Answear" (the spelling is the database's) was originally the only text column,
/// and it holds answer fragments rather than questions. scripts/schema-authoring.sql
/// added QuestionText, QuestionType, Options and IsRequired; rows written before
/// that still have them null, so the API falls back to Answear and to options
/// derived from dbo.SurveyAnswer for those.
/// </summary>
public partial class Question
{
    public int QuestionId { get; set; }

    public string? Answear { get; set; }

    public int? SurveyId { get; set; }

    /// <summary>The question itself. Null on rows that predate the column.</summary>
    public string? QuestionText { get; set; }

    /// <summary>text, single-choice, multiple-choice, checkbox or rating.</summary>
    public string? QuestionType { get; set; }

    /// <summary>JSON array of option labels, e.g. ["Agree","Disagree"].</summary>
    public string? Options { get; set; }

    public bool? IsRequired { get; set; }

    public virtual Survey? Survey { get; set; }

    public virtual ICollection<SurveyAnswer> SurveyAnswers { get; set; } = new List<SurveyAnswer>();
}
