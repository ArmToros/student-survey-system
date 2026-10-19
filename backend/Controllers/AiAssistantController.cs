using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/ai-assistant")]
    [Authorize]
    public class AiAssistantController : ControllerBase
    {
        private readonly SssContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public AiAssistantController(
            SssContext context,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        /// <summary>
        /// Personal context comes from the token, not the request body, so the
        /// assistant cannot be asked about somebody else's account.
        /// </summary>
        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
                ? id
                : null;

        public class AssistantMessage
        {
            public string Role { get; set; } = "user";
            public string Content { get; set; } = "";
        }

        public class AssistantRequest
        {
            public int? UserId { get; set; }
            public string Message { get; set; } = "";
            public List<AssistantMessage> History { get; set; } = new();
        }

        [HttpPost("chat")]
        public async Task<ActionResult> Chat([FromBody] AssistantRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "Message is required" });
            }

            var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return StatusCode(503, new
                {
                    message = "AI assistant is not configured. Set OPENAI_API_KEY in your local .env file and restart the backend."
                });
            }

            var model = _configuration["OpenAI:Model"];
            if (string.IsNullOrWhiteSpace(model))
            {
                model = "gpt-4o-mini";
            }

            var contextSnapshot = await BuildUniversityContextAsync(CallerId);
            var input = BuildOpenAiInput(request, contextSnapshot);

            using var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var body = new
            {
                model,
                input,
                max_output_tokens = 700
            };

            try
            {
                using var response = await httpClient.PostAsync(
                    "https://api.openai.com/v1/responses",
                    new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));

                var responseText = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    return StatusCode((int)response.StatusCode, new
                    {
                        message = "OpenAI request failed",
                        detail = TryReadOpenAiError(responseText)
                    });
                }

                var answer = ExtractOutputText(responseText);
                return Ok(new
                {
                    answer = string.IsNullOrWhiteSpace(answer)
                        ? "I could not generate an answer. Please try again."
                        : answer
                });
            }
            catch (TaskCanceledException)
            {
                return StatusCode(504, new
                {
                    message = "OpenAI request timed out. Please try again."
                });
            }
            catch (HttpRequestException exception)
            {
                return StatusCode(502, new
                {
                    message = "Could not reach OpenAI from the backend.",
                    detail = exception.Message
                });
            }
            catch (JsonException)
            {
                return StatusCode(502, new
                {
                    message = "OpenAI returned an unexpected response. Please try again."
                });
            }
        }

        private async Task<string> BuildUniversityContextAsync(int? userId)
        {
            var user = userId.HasValue
                ? await _context.UserAccounts.FirstOrDefaultAsync(item => item.Id == userId.Value)
                : null;

            // dbo.Survey carries no status or date, so surveys are ordered by key
            // and always reported as active.
            var surveys = await _context.Surveys
                .OrderByDescending(item => item.SurveyId)
                .Take(8)
                .Select(item => new
                {
                    Id = item.SurveyId,
                    Title = item.Topic,
                    Status = "active",
                    Questions = item.Questions.Count,
                    Responses = item.SurveySessions.Count
                })
                .ToListAsync();

            var news = await _context.News
                .Include(item => item.NewsType)
                .OrderByDescending(item => item.CreatedAt)
                .Take(6)
                .Select(item => new
                {
                    item.Title,
                    item.Content,
                    Type = item.NewsType.Name,
                    item.CreatedAt
                })
                .ToListAsync();

            var courses = await _context.Courses
                .OrderBy(item => item.CourseNumber)
                .Take(10)
                .Select(item => new
                {
                    item.CourseNumber,
                    item.CourseName
                })
                .ToListAsync();

            return JsonSerializer.Serialize(new
            {
                CurrentUser = user == null ? null : new
                {
                    user.Id,
                    user.Role,
                    user.FirstName,
                    user.LastName,
                    user.Email
                },
                Surveys = surveys,
                News = news,
                Courses = courses
            });
        }

        private static object[] BuildOpenAiInput(AssistantRequest request, string contextSnapshot)
        {
            var messages = new List<object>
            {
                new
                {
                    role = "developer",
                    content = """
You are the AI Assistant inside the Student Survey System university web app.
Answer student questions clearly, politely, and practically.
Use the provided live university-system context when relevant.
If the answer is not in the context, say what you know generally and suggest who to contact rather than inventing exact university policy.
Keep answers concise unless the student asks for detail.
"""
                },
                new
                {
                    role = "developer",
                    content = $"Live university-system context JSON:\n{contextSnapshot}"
                }
            };

            foreach (var item in request.History.TakeLast(8))
            {
                if (string.IsNullOrWhiteSpace(item.Content))
                {
                    continue;
                }

                var role = item.Role == "assistant" ? "assistant" : "user";
                messages.Add(new { role, content = item.Content });
            }

            messages.Add(new { role = "user", content = request.Message.Trim() });
            return messages.ToArray();
        }

        private static string ExtractOutputText(string responseJson)
        {
            using var document = JsonDocument.Parse(responseJson);
            if (document.RootElement.TryGetProperty("output_text", out var outputText))
            {
                return outputText.GetString() ?? "";
            }

            if (!document.RootElement.TryGetProperty("output", out var output))
            {
                return "";
            }

            var builder = new StringBuilder();
            foreach (var outputItem in output.EnumerateArray())
            {
                if (!outputItem.TryGetProperty("content", out var content))
                {
                    continue;
                }

                foreach (var contentItem in content.EnumerateArray())
                {
                    if (contentItem.TryGetProperty("text", out var text))
                    {
                        builder.AppendLine(text.GetString());
                    }
                }
            }

            return builder.ToString().Trim();
        }

        private static string TryReadOpenAiError(string responseJson)
        {
            try
            {
                using var document = JsonDocument.Parse(responseJson);
                if (document.RootElement.TryGetProperty("error", out var error) &&
                    error.TryGetProperty("message", out var message))
                {
                    return message.GetString() ?? "Unknown OpenAI error";
                }
            }
            catch
            {
                return "Unable to parse OpenAI error response";
            }

            return "Unknown OpenAI error";
        }
    }
}
