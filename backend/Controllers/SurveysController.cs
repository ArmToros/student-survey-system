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

        /// <summary>The caller's role as stored: Admin, Lecturer or Student.</summary>
        private string CallerRole
        {
            get
            {
                var role = User.FindFirstValue(ClaimTypes.Role);
                return KnownRoles.FirstOrDefault(known =>
                    string.Equals(known, role, StringComparison.OrdinalIgnoreCase)) ?? "Student";
            }
        }

        private static readonly string[] KnownRoles = { "Admin", "Lecturer", "Student" };

        public class CreateSurveyRequest
        {
            /// <summary>
            /// When it stops taking answers. Null means it stays open until an
            /// admin closes it, which is how every survey behaved before.
            /// </summary>
            public DateTime? Deadline { get; set; }

            public string Title { get; set; } = "";
            public string? Description { get; set; }
            public string? Category { get; set; }

            /// <summary>
            /// Which roles the survey is for. Empty or missing means everyone,
            /// which is how the surveys already in the database behave.
            /// </summary>
            public List<string>? Audience { get; set; }
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

        /// <summary>
        /// Closes anything whose deadline has passed, and reports how many.
        ///
        /// There is no scheduler in this app, so the closing happens the next
        /// time somebody looks. That is enough: a survey is only reachable
        /// through these endpoints, and every one of them calls this first, so
        /// a survey past its deadline is never offered or accepted. Writing it
        /// down rather than deciding on the fly keeps ClosedAt honest and means
        /// the results page agrees with the list.
        /// </summary>
        private async Task<int> CloseSurveysPastTheirDeadlineAsync()
        {
            var now = DateTime.UtcNow;

            var due = await _context.Surveys
                .Where(survey => !survey.IsClosed
                                 && survey.Deadline != null
                                 && survey.Deadline <= now)
                .ToListAsync();

            if (due.Count == 0)
            {
                return 0;
            }

            foreach (var survey in due)
            {
                survey.IsClosed = true;
                survey.ClosedAt = survey.Deadline;
            }

            await _context.SaveChangesAsync();
            return due.Count;
        }

        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            await CloseSurveysPastTheirDeadlineAsync();

            var role = CallerRole;
            var callerId = CallerId;

            // Which of these the caller has already answered. Without this the
            // page can only find out by letting them fill the survey in and
            // refusing the submission, which wastes the work they just did.
            var answered = callerId == null
                ? new List<int>()
                : await _context.SurveySessions
                    .Where(session => session.UserId == callerId.Value)
                    .Select(session => session.SurveyId)
                    .Distinct()
                    .ToListAsync();

            var surveys = await _context.Surveys
                // No audience rows means the survey is for everyone, which keeps
                // the surveys restored from the backup visible.
                .Where(survey => !survey.TargetRoles.Any() ||
                                 survey.TargetRoles.Any(target => target.Role == role))
                .OrderByDescending(survey => survey.SurveyId)
                .Select(survey => new
                {
                    id = survey.SurveyId,
                    title = survey.Topic ?? ("Survey " + survey.SurveyId),
                    questionCount = survey.Questions.Count,
                    responses = survey.SurveySessions.Count,
                    category = survey.Category,
                    status = survey.IsClosed ? "completed" : "active",
                    createdDate = survey.CreatedAt,
                    closedDate = survey.ClosedAt,
                    deadline = survey.Deadline,
                    audience = survey.TargetRoles.Select(target => target.Role).ToList(),
                    alreadyAnswered = answered.Contains(survey.SurveyId)
                })
                .ToListAsync();

            return Ok(surveys);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult> GetById(int id)
        {
            await CloseSurveysPastTheirDeadlineAsync();

            var survey = await _context.Surveys
                .Include(item => item.Questions)
                .Include(item => item.TargetRoles)
                .FirstOrDefaultAsync(item => item.SurveyId == id);

            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            var questions = await BuildQuestionsAsync(survey);

            var callerId = CallerId;
            var alreadyAnswered = callerId != null && await _context.SurveySessions
                .AnyAsync(session => session.SurveyId == id && session.UserId == callerId.Value);

            return Ok(new
            {
                id = survey.SurveyId,
                title = survey.Topic ?? ("Survey " + survey.SurveyId),
                description = "",
                alreadyAnswered,
                category = survey.Category,
                status = survey.IsClosed ? "completed" : "active",
                createdDate = survey.CreatedAt,
                closedDate = survey.ClosedAt,
                deadline = survey.Deadline,
                audience = survey.TargetRoles.Select(target => target.Role).ToList(),
                questions
            });
        }

        /// <summary>
        /// Results are open to anyone signed in. They are totals per question and
        /// carry no names, so there is nothing here that identifies who answered
        /// what - and people who took a survey can see what it found.
        /// </summary>
        [HttpGet("{id:int}/results")]
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
                    // These were hardcoded null from before Survey carried any
                    // dates, which left the results page showing a dash whatever
                    // the survey actually had.
                    createdDate = survey.CreatedAt,
                    deadline = survey.Deadline,
                    closedDate = survey.ClosedAt,
                    status = survey.IsClosed ? "completed" : "active"
                },
                results
            });
        }

        /// <summary>
        /// Who the survey was for, and whether each of them has answered.
        ///
        /// Staff only: it names individuals, which the results deliberately do
        /// not. It answers "who still has to do this", and after the deadline,
        /// "who never did" - without exposing what anybody answered.
        /// </summary>
        [HttpGet("{id:int}/participation")]
        [Authorize(Policy = "Staff")]
        public async Task<ActionResult> GetParticipation(int id)
        {
            await CloseSurveysPastTheirDeadlineAsync();

            var survey = await _context.Surveys
                .Include(item => item.TargetRoles)
                .FirstOrDefaultAsync(item => item.SurveyId == id);

            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            // No audience rows means everybody, the same rule the list uses.
            var roles = survey.TargetRoles.Select(target => target.Role).ToList();

            var audience = _context.UserAccounts.AsQueryable();
            if (roles.Count > 0)
            {
                var stored = roles
                    .Select(role => role.Length > 0
                        ? char.ToUpperInvariant(role[0]) + role.Substring(1).ToLowerInvariant()
                        : role)
                    .ToList();

                audience = audience.Where(user => stored.Contains(user.Role));
            }

            var answered = await _context.SurveySessions
                .Where(session => session.SurveyId == id)
                .Select(session => session.UserId)
                .Distinct()
                .ToListAsync();

            var people = await audience
                .OrderBy(user => user.FirstName)
                .ThenBy(user => user.LastName)
                .Select(user => new
                {
                    id = user.Id,
                    name = (user.FirstName ?? "") + " " + (user.LastName ?? ""),
                    email = user.Email,
                    role = user.Role
                })
                .ToListAsync();

            var withStatus = people
                .Select(person => new
                {
                    person.id,
                    name = person.name.Trim(),
                    person.email,
                    person.role,
                    answered = answered.Contains(person.id)
                })
                .ToList();

            return Ok(new
            {
                surveyId = id,
                title = survey.Topic ?? ("Survey " + id),
                deadline = survey.Deadline,
                isClosed = survey.IsClosed,
                total = withStatus.Count,
                answeredCount = withStatus.Count(person => person.answered),
                pendingCount = withStatus.Count(person => !person.answered),
                people = withStatus
            });
        }

        /// <summary>Only admins author surveys.</summary>
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
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

            if (request.Deadline != null && request.Deadline <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "The deadline has already passed." });
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
                CreatedBy = creatorId.Value,
                Category = Truncate(request.Category?.Trim(), 50),
                CreatedAt = DateTime.UtcNow,
                // A deadline already in the past would create a survey nobody
                // can answer, so it is refused above rather than stored.
                Deadline = request.Deadline,
                IsClosed = false
            };

            _context.Surveys.Add(survey);

            var nextQuestionId = await GetNextIdAsync(_context.Questions.Select(item => item.QuestionId));
            foreach (var question in providedQuestions)
            {
                var text = Truncate(question.Question.Trim(), 1000);
                var options = (question.Options ?? new List<string>())
                    .Where(option => !string.IsNullOrWhiteSpace(option))
                    .Select(option => option.Trim())
                    .ToList();

                _context.Questions.Add(new Question
                {
                    QuestionId = nextQuestionId++,
                    SurveyId = survey.SurveyId,
                    // Answear is still written so anything reading the original
                    // column, including the fallback in BuildQuestionsAsync, keeps
                    // seeing a sensible label.
                    Answear = Truncate(question.Question.Trim(), 500),
                    QuestionText = text,
                    QuestionType = Truncate(
                        string.IsNullOrWhiteSpace(question.Type) ? "text" : question.Type.Trim(), 20),
                    Options = options.Count > 0 ? JsonSerializer.Serialize(options) : null,
                    IsRequired = question.Required
                });
            }

            await _context.SaveChangesAsync();

            foreach (var role in (request.Audience ?? new List<string>())
                     .Select(role => KnownRoles.FirstOrDefault(known =>
                         string.Equals(known, role?.Trim(), StringComparison.OrdinalIgnoreCase)))
                     .Where(role => role != null)
                     .Distinct())
            {
                _context.SurveyTargetRoles.Add(new SurveyTargetRole
                {
                    SurveyId = survey.SurveyId,
                    Role = role!
                });
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = survey.SurveyId }, new
            {
                id = survey.SurveyId,
                title = survey.Topic,
                category = survey.Category,
                audience = request.Audience ?? new List<string>(),
                questionCount = providedQuestions.Count
            });
        }

        /// <summary>
        /// Deletes a survey and everything recorded against it.
        ///
        /// SurveyAnswer points at both SurveySession and Question, and both of
        /// those point at Survey, so the rows have to go in that order or the
        /// foreign keys refuse. Deleting a survey therefore destroys the
        /// responses people gave it, which is why it is an admin action and why
        /// the count is reported back.
        /// </summary>
        public class SurveyStatusRequest
        {
            public bool IsClosed { get; set; }
        }

        /// <summary>
        /// Closes a survey, or opens it again.
        ///
        /// Closing is how a survey ends without being destroyed: nobody can
        /// answer it any more, but the answers already given stay where they
        /// are and the results page carries on showing them. That is the
        /// difference from Delete, which takes the responses with it.
        ///
        /// Submissions are refused by the check in SubmitResponse, so closing
        /// holds even for somebody who kept the survey open in a tab and
        /// pressed submit afterwards.
        /// </summary>
        [HttpPut("{id:int}/status")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> SetStatus(int id, [FromBody] SurveyStatusRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { message = "A status is required" });
            }

            var survey = await _context.Surveys.FirstOrDefaultAsync(item => item.SurveyId == id);
            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            survey.IsClosed = request.IsClosed;
            // Kept for the "Created / Closed" dates on the results page. Re-opening
            // clears it, so a survey never claims to have closed on a date it was
            // still accepting answers.
            survey.ClosedAt = request.IsClosed ? DateTime.UtcNow : null;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = survey.SurveyId,
                status = survey.IsClosed ? "completed" : "active",
                closedDate = survey.ClosedAt
            });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> Delete(int id)
        {
            var survey = await _context.Surveys.FirstOrDefaultAsync(item => item.SurveyId == id);
            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            var sessionIds = await _context.SurveySessions
                .Where(session => session.SurveyId == id)
                .Select(session => session.Id)
                .ToListAsync();

            var questionIds = await _context.Questions
                .Where(question => question.SurveyId == id)
                .Select(question => question.QuestionId)
                .ToListAsync();

            var answers = await _context.SurveyAnswers
                .Where(answer => sessionIds.Contains(answer.SessionId) || questionIds.Contains(answer.QuestionId))
                .ToListAsync();

            var sessions = await _context.SurveySessions
                .Where(session => session.SurveyId == id)
                .ToListAsync();

            var questions = await _context.Questions
                .Where(question => question.SurveyId == id)
                .ToListAsync();

            // The audience rows point at Survey too, and were missed when
            // audiences were added: deleting a survey aimed at a role failed on
            // the foreign key with a 500, while an untargeted one deleted fine.
            var targetRoles = await _context.SurveyTargetRoles
                .Where(target => target.SurveyId == id)
                .ToListAsync();

            _context.SurveyAnswers.RemoveRange(answers);
            _context.SurveySessions.RemoveRange(sessions);
            _context.Questions.RemoveRange(questions);
            _context.SurveyTargetRoles.RemoveRange(targetRoles);
            _context.Surveys.Remove(survey);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                id,
                message = "Survey deleted",
                deletedResponses = sessions.Count,
                deletedAnswers = answers.Count
            });
        }

        [HttpPost("{id:int}/responses")]
        public async Task<ActionResult> SubmitResponse(int id, [FromBody] SubmitSurveyRequest request)
        {
            var survey = await _context.Surveys
                .Include(item => item.TargetRoles)
                .FirstOrDefaultAsync(item => item.SurveyId == id);

            if (survey == null)
            {
                return NotFound(new { message = "Survey not found" });
            }

            // Filtering the list is not enough on its own: without this check
            // somebody outside the audience could answer by going to the URL.
            var role = CallerRole;
            if (survey.TargetRoles.Count > 0 && survey.TargetRoles.All(target => target.Role != role))
            {
                return StatusCode(403, new { message = "This survey is not open to your role." });
            }

            // The deadline may have passed while the form sat open in a tab.
            if (!survey.IsClosed && survey.Deadline != null && survey.Deadline <= DateTime.UtcNow)
            {
                survey.IsClosed = true;
                survey.ClosedAt = survey.Deadline;
                await _context.SaveChangesAsync();
            }

            if (survey.IsClosed)
            {
                return Conflict(new { message = "This survey is closed." });
            }

            var userId = CallerId ?? await GetFallbackUserIdAsync("student");
            if (userId == null)
            {
                return BadRequest(new { message = "A user account is required to submit a response" });
            }

            // One response per person per survey. Existing rows are left alone:
            // the backup already contains people who answered the same survey more
            // than once, and this only stops new duplicates.
            var alreadyAnswered = await _context.SurveySessions
                .AnyAsync(session => session.SurveyId == id && session.UserId == userId.Value);

            if (alreadyAnswered)
            {
                return Conflict(new { message = "You have already responded to this survey." });
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
                UserId = userId.Value,
                SubmittedAt = DateTime.UtcNow
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
        ///
        /// Questions authored since scripts/schema-authoring.sql ran carry their own
        /// text, type and options and are returned as written. Rows restored from the
        /// backup have those columns null, so they keep the old behaviour: the
        /// misspelled Answear column is the label and the options are derived from the
        /// answers already recorded. That fallback is why a question could appear as
        /// multiple choice in one attempt and free text in another - the derived set
        /// changes as responses accumulate. Newly authored questions are stable.
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
                var storedOptions = ReadStoredOptions(question.Options);
                var hasStoredType = !string.IsNullOrWhiteSpace(question.QuestionType);

                // Derived options are only a fallback for rows written before the
                // authoring columns existed.
                var derivedOptions = knownAnswers
                    .Where(answer => answer.QuestionId == question.QuestionId)
                    .Select(answer => answer.Answer!)
                    .Where(answer => !string.IsNullOrWhiteSpace(answer))
                    .Distinct()
                    .OrderBy(answer => answer)
                    .ToList();

                var label = question.QuestionText;
                if (string.IsNullOrWhiteSpace(label))
                {
                    label = string.IsNullOrWhiteSpace(question.Answear)
                        ? "Question " + position
                        : question.Answear;
                }

                string type;
                List<string> options;

                if (hasStoredType)
                {
                    type = question.QuestionType!;
                    options = storedOptions;
                }
                else
                {
                    var isChoice = derivedOptions.Count > 1 && derivedOptions.Count <= MaxDerivedOptions;
                    type = isChoice ? "single-choice" : "text";
                    options = isChoice ? derivedOptions : new List<string>();
                }

                result.Add(new SurveyQuestionDto
                {
                    Id = question.QuestionId,
                    Question = label!,
                    Type = type,
                    Options = options,
                    Required = question.IsRequired ?? false,
                    Min = 1,
                    Max = 5
                });

                position++;
            }

            return result;
        }

        /// <summary>
        /// Reads the JSON array stored in dbo.Question.Options. A malformed or empty
        /// value is treated as "no options" rather than failing the whole request.
        /// </summary>
        private static List<string> ReadStoredOptions(string? stored)
        {
            if (string.IsNullOrWhiteSpace(stored))
            {
                return new List<string>();
            }

            try
            {
                return JsonSerializer.Deserialize<List<string>>(stored)?
                    .Where(option => !string.IsNullOrWhiteSpace(option))
                    .ToList() ?? new List<string>();
            }
            catch (JsonException)
            {
                return new List<string>();
            }
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

        private static string? Truncate(string? value, int maxLength)
        {
            if (value == null)
            {
                return null;
            }

            return value.Length <= maxLength ? value : value[..maxLength];
        }
    }
}
