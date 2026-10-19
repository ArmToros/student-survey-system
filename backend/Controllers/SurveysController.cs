using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace backend.Controllers
{
    /// <summary>
    /// Surveys, served from the survey tables of the restored database:
    /// Survey -> Question for the definition, SurveySession -> SurveyAnswer for responses.
    ///
    /// Two gaps in that schema shape what this controller can do:
    ///  * dbo.Question has no text/type/options columns. "Answear" is its only text
    ///    column, so it is used as the question label, and the answer options are
    ///    derived from the values already recorded in dbo.SurveyAnswer.
    ///  * dbo.Survey has no status or date columns, so every survey reports as
    ///    active with null dates.
    /// scripts/migrate-question-text.sql would close the first gap but is left unapplied.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SurveysController : ControllerBase
    {
        /// <summary>A question with more options than this is treated as free text.</summary>
        private const int MaxDerivedOptions = 12;

        private readonly SssContext _context;

        public SurveysController(SssContext context)
        {
            _context = context;
        }

        /// <summary>
        /// The signed-in account id, taken from the token rather than the request
        /// body, so a caller cannot create surveys or answer them as someone else.
        /// </summary>
        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        public class CreateSurveyRequest
        {
            public string Title { get; set; } = "";
            public string? Description { get; set; }
            public List<SurveyQuestionDto> Questions { get; set; } = new();
            public int? CreatedBy { get; set; }
            public int? AssignedAdmin { get; set; }
        }

        public class SurveyQuestionDto
        {
            public int? Id { get; set; }
            public string Type { get; set; } = "text";
            public string Question { get; set; } = "";
            public string? Description { get; set; }
            public List<string>? Options { get; set; }
            public bool Required { get; set; }
            public string? Placeholder { get; set; }
            public int? Min { get; set; }
            public int? Max { get; set; }
        }

        public class SubmitSurveyRequest
        {
            public int? UserId { get; set; }
            public Dictionary<string, JsonElement> Responses { get; set; } = new();
        }

        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            var surveys = await _context.Surveys
                .OrderByDescending(survey => survey.SurveyId)
                .Select(survey => new
                {
                    id = survey.SurveyId,
                    title = survey.Topic ?? ("Survey " + survey.SurveyId),
                    questionCount = survey.Questions.Count,
                    responses = survey.SurveySessions.Count,
                    // dbo.Survey has no status column, so nothing can ever be "completed".
                    status = "active",
                    createdDate = (DateTime?)null
                })
                .ToListAsync();

            return Ok(surveys);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult> GetById(int id)
        {
            var survey = await _context.Surveys
                .Include(item => item.Questions)
                .FirstOrDefaultAsync(item => item.SurveyId == id);

            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            var questions = await BuildQuestionsAsync(survey);

            return Ok(new
            {
                id = survey.SurveyId,
                title = survey.Topic ?? ("Survey " + survey.SurveyId),
                description = "",
                status = "active",
                questions
            });
        }

        /// <summary>Aggregated answers are for staff; students only take surveys.</summary>
        [HttpGet("{id:int}/results")]
        [Authorize(Policy = "Staff")]
        public async Task<ActionResult> GetResults(int id)
        {
            var survey = await _context.Surveys
                .Include(item => item.Questions)
                .FirstOrDefaultAsync(item => item.SurveyId == id);

            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            var questions = await BuildQuestionsAsync(survey);
            var questionIds = questions.Select(question => question.Id!.Value).ToList();

            var answers = await _context.SurveyAnswers
                .Where(answer => questionIds.Contains(answer.QuestionId))
                .Select(answer => new { answer.QuestionId, answer.Answer })
                .ToListAsync();

            var totalResponses = await _context.SurveySessions
                .CountAsync(session => session.SurveyId == id);

            var results = questions.Select(question =>
            {
                var given = answers
                    .Where(answer => answer.QuestionId == question.Id)
                    .Select(answer => answer.Answer)
                    .Where(answer => !string.IsNullOrWhiteSpace(answer))
                    .Select(answer => answer!)
                    .ToList();

                if (question.Type == "single-choice")
                {
                    // Seed every known option at zero so empty options still render.
                    var counts = new Dictionary<string, int>();
                    foreach (var option in question.Options ?? new List<string>())
                    {
                        counts[option] = 0;
                    }

                    foreach (var answer in given)
                    {
                        counts.TryAdd(answer, 0);
                        counts[answer]++;
                    }

                    return (object)new
                    {
                        id = question.Id,
                        question = question.Question,
                        type = question.Type,
                        responses = counts,
                        total = given.Count
                    };
                }

                return new
                {
                    id = question.Id,
                    question = question.Question,
                    type = "text",
                    responses = given,
                    total = given.Count
                };
            }).ToList();

            return Ok(new
            {
                survey = new
                {
                    id = survey.SurveyId,
                    title = survey.Topic ?? ("Survey " + survey.SurveyId),
                    description = "",
                    totalResponses,
                    createdDate = (DateTime?)null,
                    endDate = (DateTime?)null,
                    status = "active"
                },
                results
            });
        }

        [HttpPost]
        [Authorize(Policy = "Staff")]
        public async Task<ActionResult> Create([FromBody] CreateSurveyRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new { message = "Survey title is required" });
            }

            var providedQuestions = (request.Questions ?? new List<SurveyQuestionDto>())
                .Where(question => !string.IsNullOrWhiteSpace(question.Question))
                .ToList();

            if (providedQuestions.Count == 0)
            {
                return BadRequest(new { message = "At least one question is required" });
            }

            var creatorId = CallerId ?? await GetFallbackUserIdAsync("lecturer");
            if (creatorId == null)
            {
                return BadRequest(new { message = "No user account is available to own this survey" });
            }

            var survey = new Survey
            {
                SurveyId = await GetNextIdAsync(_context.Surveys.Select(item => item.SurveyId)),
                Topic = Truncate(request.Title.Trim(), 100),
                CreatedBy = creatorId.Value
            };

            _context.Surveys.Add(survey);

            var nextQuestionId = await GetNextIdAsync(_context.Questions.Select(item => item.QuestionId));
            foreach (var question in providedQuestions)
            {
                // Only the question text can be stored: dbo.Question has no column
                // for type, options, required or placeholder, so those are dropped.
                _context.Questions.Add(new Question
                {
                    QuestionId = nextQuestionId++,
                    SurveyId = survey.SurveyId,
                    Answear = Truncate(question.Question.Trim(), 500)
                });
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = survey.SurveyId }, new
            {
                id = survey.SurveyId,
                title = survey.Topic,
                questionCount = providedQuestions.Count,
                note = "Question type, options and validation are not stored: the Question table has no columns for them."
            });
        }

        [HttpPost("{id:int}/responses")]
        public async Task<ActionResult> SubmitResponse(int id, [FromBody] SubmitSurveyRequest request)
        {
            var surveyExists = await _context.Surveys.AnyAsync(survey => survey.SurveyId == id);
            if (!surveyExists)
            {
                return NotFound(new { message = "Survey not found" });
            }

            var userId = CallerId ?? await GetFallbackUserIdAsync("student");
            if (userId == null)
            {
                return BadRequest(new { message = "A user account is required to submit a response" });
            }

            var questionIds = await _context.Questions
                .Where(question => question.SurveyId == id)
                .Select(question => question.QuestionId)
                .ToListAsync();

            // SurveySession.ID is an identity column, so save first to get the key
            // that the answer rows reference.
            var session = new SurveySession
            {
                SurveyId = id,
                UserId = userId.Value
            };

            _context.SurveySessions.Add(session);
            await _context.SaveChangesAsync();

            var saved = 0;
            foreach (var entry in request?.Responses ?? new Dictionary<string, JsonElement>())
            {
                if (!int.TryParse(entry.Key, out var questionId) || !questionIds.Contains(questionId))
                {
                    continue;
                }

                // A checkbox question arrives as an array; store one row per selection.
                foreach (var answer in ReadAnswers(entry.Value))
                {
                    _context.SurveyAnswers.Add(new SurveyAnswer
                    {
                        SessionId = session.Id,
                        QuestionId = questionId,
                        Answer = answer
                    });
                    saved++;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Response saved", sessionId = session.Id, answers = saved });
        }

        /// <summary>
        /// Turns the Question rows of a survey into the shape the React form expects.
        /// Options are derived from the answers already recorded for each question,
        /// because the schema stores no option list of its own.
        /// </summary>
        private async Task<List<SurveyQuestionDto>> BuildQuestionsAsync(Survey survey)
        {
            var questions = survey.Questions
                .OrderBy(question => question.QuestionId)
                .ToList();

            var questionIds = questions.Select(question => question.QuestionId).ToList();

            var knownAnswers = await _context.SurveyAnswers
                .Where(answer => questionIds.Contains(answer.QuestionId) && answer.Answer != null)
                .Select(answer => new { answer.QuestionId, answer.Answer })
                .Distinct()
                .ToListAsync();

            var result = new List<SurveyQuestionDto>();
            var position = 1;

            foreach (var question in questions)
            {
                var options = knownAnswers
                    .Where(answer => answer.QuestionId == question.QuestionId)
                    .Select(answer => answer.Answer!)
                    .Where(answer => !string.IsNullOrWhiteSpace(answer))
                    .Distinct()
                    .OrderBy(answer => answer)
                    .ToList();

                var isChoice = options.Count > 1 && options.Count <= MaxDerivedOptions;

                result.Add(new SurveyQuestionDto
                {
                    Id = question.QuestionId,
                    Question = string.IsNullOrWhiteSpace(question.Answear)
                        ? "Question " + position
                        : question.Answear!,
                    Type = isChoice ? "single-choice" : "text",
                    Options = isChoice ? options : new List<string>(),
                    Required = false,
                    Min = 1,
                    Max = 5
                });

                position++;
            }

            return result;
        }

        /// <summary>Reads one submitted answer value as the strings to store.</summary>
        private static IEnumerable<string> ReadAnswers(JsonElement value)
        {
            if (value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in value.EnumerateArray())
                {
                    var text = ReadAnswerText(item);
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        yield return text;
                    }
                }

                yield break;
            }

            var single = ReadAnswerText(value);
            if (!string.IsNullOrWhiteSpace(single))
            {
                yield return single;
            }
        }

        private static string ReadAnswerText(JsonElement answer)
        {
            return answer.ValueKind switch
            {
                JsonValueKind.String => answer.GetString() ?? "",
                JsonValueKind.Number => answer.ToString(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Null or JsonValueKind.Undefined => "",
                _ => answer.ToString()
            };
        }

        /// <summary>Roles are stored capitalised ("Admin"), so match case-insensitively.</summary>
        private async Task<int?> GetFallbackUserIdAsync(string role)
        {
            var normalized = role.ToLowerInvariant();

            var user = await _context.UserAccounts
                .Where(item => item.Role != null && item.Role.ToLower() == normalized)
                .OrderBy(item => item.Id)
                .FirstOrDefaultAsync();

            if (user != null)
            {
                return user.Id;
            }

            return await _context.UserAccounts
                .OrderBy(item => item.Id)
                .Select(item => (int?)item.Id)
                .FirstOrDefaultAsync();
        }

        private static async Task<int> GetNextIdAsync(IQueryable<int> ids)
        {
            if (!await ids.AnyAsync())
            {
                return 1;
            }

            return await ids.MaxAsync() + 1;
        }

        private static string Truncate(string value, int maxLength)
        {
            return value.Length <= maxLength ? value : value[..maxLength];
        }
    }
}
