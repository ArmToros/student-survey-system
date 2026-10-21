using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers
{
    /// <summary>
    /// Support: a list of common questions with ready-made answers, and the
    /// conversations that everything else turns into.
    ///
    /// Picking a preset question shows its answer and starts nothing. Choosing
    /// "Other" and writing a question opens a dbo.Chat assigned to an admin, with
    /// the question as the first dbo.ChatMessage. Either side can reply, either
    /// side can close it, and either side can then remove it from their own list
    /// without destroying it for the other.
    ///
    /// Who may do what, taken from the token rather than the request body:
    ///   anyone signed in   read the preset questions
    ///   admin              add, edit and retire preset questions
    ///   anyone signed in   open a conversation, and see their own
    ///   participants       reply, close, and hide their own copy
    /// </summary>
    [ApiController]
    [Route("api/support")]
    [Authorize]
    public class SupportController : ControllerBase
    {
        private readonly SssContext _context;

        public SupportController(SssContext context)
        {
            _context = context;
        }

        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        private bool CallerIsAdmin => User.IsInRole("admin");

        public class BotNameRequest
        {
            public string Name { get; set; } = "";
        }

        public class PresetQuestionRequest
        {
            public string Question { get; set; } = "";
            public string Answer { get; set; } = "";
            public int? SortOrder { get; set; }
            public bool? IsActive { get; set; }
        }

        public class NewChatRequest
        {
            public string? Title { get; set; }
            public string Message { get; set; } = "";
        }

        public class MessageRequest
        {
            public string Message { get; set; } = "";
        }

        // -------------------------------------------------------------------- bot

        private const string BotNameKey = "SupportBotName";
        private const string DefaultBotName = "Bot AI";

        /// <summary>
        /// What the support bot is called. The preset questions are shown inside
        /// a conversation with it, so the name appears all over the chat page.
        /// </summary>
        [HttpGet("bot")]
        public async Task<ActionResult> GetBot()
        {
            var setting = await _context.AppSettings
                .FirstOrDefaultAsync(item => item.SettingKey == BotNameKey);

            return Ok(new
            {
                name = string.IsNullOrWhiteSpace(setting?.Value) ? DefaultBotName : setting!.Value
            });
        }

        [HttpPut("bot")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> UpdateBot([FromBody] BotNameRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "A name is required" });
            }

            var setting = await _context.AppSettings
                .FirstOrDefaultAsync(item => item.SettingKey == BotNameKey);

            if (setting == null)
            {
                setting = new AppSetting { SettingKey = BotNameKey };
                _context.AppSettings.Add(setting);
            }

            setting.Value = Truncate(request.Name.Trim(), 400);
            setting.UpdatedBy = CallerId;
            setting.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { name = setting.Value });
        }

        // ---------------------------------------------------------------- presets

        [HttpGet("questions")]
        public async Task<ActionResult> GetQuestions()
        {
            // Admins maintain the list, so they see retired entries too.
            var query = _context.PresetQuestions.AsQueryable();
            if (!CallerIsAdmin)
            {
                query = query.Where(item => item.IsActive);
            }

            var questions = await query
                .OrderBy(item => item.SortOrder)
                .ThenBy(item => item.Question)
                .Select(item => new
                {
                    id = item.Id,
                    question = item.Question,
                    answer = item.Answer,
                    sortOrder = item.SortOrder,
                    isActive = item.IsActive
                })
                .ToListAsync();

            return Ok(questions);
        }

        [HttpPost("questions")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> CreateQuestion([FromBody] PresetQuestionRequest request)
        {
            if (request == null ||
                string.IsNullOrWhiteSpace(request.Question) ||
                string.IsNullOrWhiteSpace(request.Answer))
            {
                return BadRequest(new { message = "A question and an answer are both required" });
            }

            var question = new PresetQuestion
            {
                Question = Truncate(request.Question.Trim(), 400)!,
                Answer = request.Answer.Trim(),
                SortOrder = request.SortOrder ?? await NextSortOrderAsync(),
                IsActive = request.IsActive ?? true,
                CreatedBy = CallerId,
                CreatedAt = DateTime.UtcNow
            };

            _context.PresetQuestions.Add(question);
            await _context.SaveChangesAsync();

            return Ok(new { id = question.Id, question = question.Question });
        }

        [HttpPut("questions/{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> UpdateQuestion(int id, [FromBody] PresetQuestionRequest request)
        {
            var question = await _context.PresetQuestions.FirstOrDefaultAsync(item => item.Id == id);
            if (question == null)
            {
                return NotFound(new { message = "Question not found" });
            }

            if (request == null)
            {
                return BadRequest(new { message = "Nothing to update" });
            }

            if (!string.IsNullOrWhiteSpace(request.Question))
            {
                question.Question = Truncate(request.Question.Trim(), 400)!;
            }

            if (!string.IsNullOrWhiteSpace(request.Answer))
            {
                question.Answer = request.Answer.Trim();
            }

            question.SortOrder = request.SortOrder ?? question.SortOrder;
            question.IsActive = request.IsActive ?? question.IsActive;
            question.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { id = question.Id, question = question.Question, isActive = question.IsActive });
        }

        [HttpDelete("questions/{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> DeleteQuestion(int id)
        {
            var question = await _context.PresetQuestions.FirstOrDefaultAsync(item => item.Id == id);
            if (question == null)
            {
                return NotFound(new { message = "Question not found" });
            }

            _context.PresetQuestions.Remove(question);
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Question deleted" });
        }

        // ------------------------------------------------------------ conversations

        [HttpGet("chats")]
        public async Task<ActionResult> GetChats()
        {
            var callerId = CallerId;
            if (callerId == null)
            {
                return Ok(Array.Empty<object>());
            }

            // Mine as the person who asked, or mine as the admin it landed on -
            // minus the ones I have taken off my own list.
            var chats = await _context.Chats
                .Where(chat =>
                    (chat.CreatedBy == callerId.Value && !chat.HiddenByAuthor) ||
                    (chat.AssignedAdmin == callerId.Value && !chat.HiddenByAdmin))
                .OrderByDescending(chat => chat.CreatedAt)
                .Select(chat => new
                {
                    id = chat.Id,
                    title = chat.Title,
                    isClosed = chat.IsClosed ?? false,
                    createdAt = chat.CreatedAt,
                    closedAt = chat.ClosedAt,
                    createdBy = chat.CreatedBy,
                    assignedAdmin = chat.AssignedAdmin,
                    askedBy = ((chat.CreatedByNavigation.FirstName ?? "") + " " + (chat.CreatedByNavigation.LastName ?? "")).Trim(),
                    adminName = ((chat.AssignedAdminNavigation.FirstName ?? "") + " " + (chat.AssignedAdminNavigation.LastName ?? "")).Trim(),
                    messages = chat.ChatMessages.Count,
                    lastMessage = chat.ChatMessages
                        .OrderByDescending(message => message.SentAt)
                        .Select(message => message.MessageText)
                        .FirstOrDefault()
                })
                .ToListAsync();

            return Ok(chats.Select(chat => new
            {
                chat.id,
                chat.title,
                chat.isClosed,
                chat.createdAt,
                chat.closedAt,
                chat.askedBy,
                chat.adminName,
                chat.messages,
                chat.lastMessage,
                mine = chat.createdBy == callerId.Value
            }));
        }

        [HttpGet("chats/{id:int}")]
        public async Task<ActionResult> GetChat(int id)
        {
            var chat = await _context.Chats
                .Include(item => item.ChatMessages)
                .FirstOrDefaultAsync(item => item.Id == id);

            if (chat == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            if (!IsParticipant(chat))
            {
                return Forbid();
            }

            var senderIds = chat.ChatMessages.Select(message => message.SentBy).Distinct().ToList();
            var senders = await _context.UserAccounts
                .Where(user => senderIds.Contains(user.Id))
                .Select(user => new { user.Id, Name = ((user.FirstName ?? "") + " " + (user.LastName ?? "")).Trim() })
                .ToDictionaryAsync(user => user.Id, user => user.Name);

            return Ok(new
            {
                id = chat.Id,
                title = chat.Title,
                isClosed = chat.IsClosed ?? false,
                createdAt = chat.CreatedAt,
                closedAt = chat.ClosedAt,
                mine = chat.CreatedBy == CallerId,
                messages = chat.ChatMessages
                    .OrderBy(message => message.SentAt)
                    .ThenBy(message => message.Id)
                    .Select(message => new
                    {
                        id = message.Id,
                        text = message.MessageText,
                        sentAt = message.SentAt,
                        sentBy = message.SentBy,
                        senderName = senders.ContainsKey(message.SentBy) ? senders[message.SentBy] : null,
                        isQuestion = message.IsQuestion,
                        own = message.SentBy == CallerId
                    })
            });
        }

        /// <summary>Opens a conversation from the "Other" option.</summary>
        [HttpPost("chats")]
        public async Task<ActionResult> CreateChat([FromBody] NewChatRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "A question is required" });
            }

            var callerId = CallerId;
            if (callerId == null)
            {
                return BadRequest(new { message = "A user account is required to ask a question" });
            }

            var adminId = await PickAdminAsync();
            if (adminId == null)
            {
                return StatusCode(503, new { message = "No administrator is available to take this question." });
            }

            // The title is what the list shows; the question itself is the first
            // message. Without one, the opening line stands in.
            var title = string.IsNullOrWhiteSpace(request.Title)
                ? Truncate(request.Message.Trim(), 120)!
                : Truncate(request.Title.Trim(), 400)!;

            var chat = new Chat
            {
                // Neither ID is an identity column, so the keys are allocated here.
                Id = await NextIdAsync(_context.Chats.Select(item => item.Id)),
                Title = title,
                CreatedBy = callerId.Value,
                AssignedAdmin = adminId.Value,
                IsClosed = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.Chats.Add(chat);
            await _context.SaveChangesAsync();

            _context.ChatMessages.Add(new ChatMessage
            {
                Id = await NextIdAsync(_context.ChatMessages.Select(item => item.Id)),
                ChatId = chat.Id,
                SentBy = callerId.Value,
                MessageText = request.Message.Trim(),
                SentAt = DateTime.UtcNow,
                IsQuestion = true
            });

            await _context.SaveChangesAsync();

            return Ok(new { id = chat.Id, title = chat.Title, assignedAdmin = chat.AssignedAdmin });
        }

        [HttpPost("chats/{id:int}/messages")]
        public async Task<ActionResult> AddMessage(int id, [FromBody] MessageRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "A message is required" });
            }

            var chat = await _context.Chats.FirstOrDefaultAsync(item => item.Id == id);
            if (chat == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            if (!IsParticipant(chat))
            {
                return Forbid();
            }

            if (chat.IsClosed == true)
            {
                return Conflict(new { message = "This conversation is closed." });
            }

            var callerId = CallerId!.Value;

            _context.ChatMessages.Add(new ChatMessage
            {
                Id = await NextIdAsync(_context.ChatMessages.Select(item => item.Id)),
                ChatId = chat.Id,
                SentBy = callerId,
                MessageText = request.Message.Trim(),
                SentAt = DateTime.UtcNow,
                IsQuestion = chat.CreatedBy == callerId
            });

            await _context.SaveChangesAsync();

            return Ok(new { id = chat.Id, message = "Message sent" });
        }

        [HttpPost("chats/{id:int}/close")]
        public async Task<ActionResult> CloseChat(int id)
        {
            var chat = await _context.Chats.FirstOrDefaultAsync(item => item.Id == id);
            if (chat == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            if (!IsOwningAdmin(chat))
            {
                return Forbid();
            }

            chat.IsClosed = true;
            chat.ClosedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { id = chat.Id, isClosed = true });
        }

        [HttpPost("chats/{id:int}/reopen")]
        public async Task<ActionResult> ReopenChat(int id)
        {
            var chat = await _context.Chats.FirstOrDefaultAsync(item => item.Id == id);
            if (chat == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            if (!IsOwningAdmin(chat))
            {
                return Forbid();
            }

            chat.IsClosed = false;
            chat.ClosedAt = null;
            await _context.SaveChangesAsync();

            return Ok(new { id = chat.Id, isClosed = false });
        }

        /// <summary>
        /// Takes the conversation off both lists. Only the assigned admin may do
        /// this, and the rows are kept: the flags hide it rather than delete it,
        /// so the exchange is still on record.
        /// </summary>
        [HttpDelete("chats/{id:int}")]
        public async Task<ActionResult> HideChat(int id)
        {
            var chat = await _context.Chats.FirstOrDefaultAsync(item => item.Id == id);
            if (chat == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            if (!IsOwningAdmin(chat))
            {
                return Forbid();
            }

            chat.HiddenByAuthor = true;
            chat.HiddenByAdmin = true;

            await _context.SaveChangesAsync();

            return Ok(new { id = chat.Id, message = "Conversation removed" });
        }

        private bool IsParticipant(Chat chat) =>
            CallerId != null && (chat.CreatedBy == CallerId || chat.AssignedAdmin == CallerId);

        /// <summary>
        /// Closing, reopening and removing a conversation belong to the admin it
        /// was assigned to. The person who asked can read and reply, but the
        /// lifecycle is not theirs to decide.
        /// </summary>
        private bool IsOwningAdmin(Chat chat) =>
            CallerId != null && chat.AssignedAdmin == CallerId;

        /// <summary>
        /// Hands the question to the admin carrying the fewest open conversations,
        /// so questions spread out instead of piling on whoever comes first.
        /// </summary>
        private async Task<int?> PickAdminAsync()
        {
            var admins = await _context.UserAccounts
                .Where(user => user.Role != null && user.Role.ToLower() == "admin")
                .Select(user => user.Id)
                .ToListAsync();

            if (admins.Count == 0)
            {
                return null;
            }

            var openCounts = await _context.Chats
                .Where(chat => chat.IsClosed != true && admins.Contains(chat.AssignedAdmin))
                .GroupBy(chat => chat.AssignedAdmin)
                .Select(group => new { AdminId = group.Key, Count = group.Count() })
                .ToListAsync();

            return admins
                .OrderBy(adminId => openCounts.FirstOrDefault(item => item.AdminId == adminId)?.Count ?? 0)
                .ThenBy(adminId => adminId)
                .First();
        }

        /// <summary>Puts a new question at the end of the list, in steps of ten
        /// so one can be slotted in between later without renumbering.</summary>
        private async Task<int> NextSortOrderAsync() =>
            await _context.PresetQuestions.AnyAsync()
                ? await _context.PresetQuestions.MaxAsync(item => item.SortOrder) + 10
                : 10;

        private static async Task<int> NextIdAsync(IQueryable<int> ids) =>
            await ids.AnyAsync() ? await ids.MaxAsync() + 1 : 1;

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
