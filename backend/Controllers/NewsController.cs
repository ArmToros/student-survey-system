using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NewsController : ControllerBase
    {
        private readonly SssContext _context;

        public NewsController(SssContext context)
        {
            _context = context;
        }

        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        /// <summary>The caller's role from the token, never from the request.</summary>
        private string CallerRole => User.FindFirstValue(ClaimTypes.Role) ?? "student";

        /// <summary>The roles an item may be aimed at, in the stored capitalisation.</summary>
        private static readonly string[] KnownRoles = { "Admin", "Lecturer", "Student" };

        public class NewsRequest
        {
            public string Title { get; set; } = "";
            public string Content { get; set; } = "";
            public int? NewsTypeId { get; set; }
            public string? Category { get; set; }

            /// <summary>
            /// Who it is for. An empty or missing list means everyone, which is
            /// how the items restored from the backup behave.
            /// </summary>
            public List<string>? Audience { get; set; }
        }

        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            var query = _context.News
                .Include(item => item.NewsType)
                .Include(item => item.CreatedByNavigation)
                .Include(item => item.NewsTargetRoles)
                .AsQueryable();

            // Admins see every article whoever it was aimed at: they write the
            // news and answer for it, so a piece they cannot see is a piece they
            // cannot correct.
            //
            // The role comes from the token rather than a query parameter. It
            // used to be passed in by the caller, so anyone could ask for
            // "?role=admin" and read news written for admins only.
            var role = CallerRole;
            if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
            {
                var stored = role.Length > 0
                    ? char.ToUpperInvariant(role[0]) + role.Substring(1).ToLowerInvariant()
                    : role;

                query = query.Where(item =>
                    !item.NewsTargetRoles.Any() ||
                    item.NewsTargetRoles.Any(target => target.Role == stored));
            }

            var news = await query
                .OrderByDescending(item => item.CreatedAt)
                .Select(item => new
                {
                    id = item.Id,
                    title = item.Title,
                    excerpt = item.Content.Length > 150 ? item.Content.Substring(0, 150) + "..." : item.Content,
                    content = item.Content,
                    author = item.CreatedByNavigation == null
                        ? "System"
                        : ((item.CreatedByNavigation.FirstName ?? "") + " " + (item.CreatedByNavigation.LastName ?? "")).Trim(),
                    date = item.CreatedAt,
                    category = item.NewsType.Name,
                    newsTypeId = item.NewsTypeId,
                    audience = item.NewsTargetRoles.Select(target => target.Role).ToList(),
                    featured = item.Id % 2 == 1
                })
                .ToListAsync();

            return Ok(news);
        }

        /// <summary>The categories an article can be filed under.</summary>
        [HttpGet("types")]
        public async Task<ActionResult> GetTypes()
        {
            var types = await _context.NewsTypes
                .OrderBy(type => type.Name)
                .Select(type => new { id = type.Id, name = type.Name })
                .ToListAsync();

            return Ok(types);
        }

        /// <summary>Publishes an article. Admins only.</summary>
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> Create([FromBody] NewsRequest request)
        {
            if (request == null ||
                string.IsNullOrWhiteSpace(request.Title) ||
                string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest(new { message = "A title and body are both required" });
            }

            var typeId = await ResolveTypeIdAsync(request);
            if (typeId == null)
            {
                return BadRequest(new { message = "Choose a category for the article" });
            }

            var item = new News
            {
                // News.ID is not an identity column, so the key is allocated here.
                Id = await _context.News.AnyAsync()
                    ? await _context.News.MaxAsync(existing => existing.Id) + 1
                    : 1,
                Title = request.Title.Trim(),
                Content = request.Content.Trim(),
                NewsTypeId = typeId.Value,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = CallerId
            };

            _context.News.Add(item);
            await _context.SaveChangesAsync();

            ApplyAudience(item.Id, request.Audience, Array.Empty<NewsTargetRole>());
            await _context.SaveChangesAsync();

            return Ok(new { id = item.Id, title = item.Title });
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> Update(int id, [FromBody] NewsRequest request)
        {
            var item = await _context.News
                .Include(existing => existing.NewsTargetRoles)
                .FirstOrDefaultAsync(existing => existing.Id == id);

            if (item == null)
            {
                return NotFound(new { message = "Article not found" });
            }

            if (request == null)
            {
                return BadRequest(new { message = "Nothing to update" });
            }

            if (!string.IsNullOrWhiteSpace(request.Title))
            {
                item.Title = request.Title.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.Content))
            {
                item.Content = request.Content.Trim();
            }

            var typeId = await ResolveTypeIdAsync(request);
            if (typeId != null)
            {
                item.NewsTypeId = typeId.Value;
            }

            if (request.Audience != null)
            {
                ApplyAudience(id, request.Audience, item.NewsTargetRoles.ToList());
            }

            await _context.SaveChangesAsync();

            return Ok(new { id = item.Id, title = item.Title });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult> Delete(int id)
        {
            var item = await _context.News
                .Include(existing => existing.NewsTargetRoles)
                .FirstOrDefaultAsync(existing => existing.Id == id);

            if (item == null)
            {
                return NotFound(new { message = "Article not found" });
            }

            // The target rows point at the article, so they go first.
            _context.NewsTargetRoles.RemoveRange(item.NewsTargetRoles);
            _context.News.Remove(item);
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Article deleted" });
        }

        /// <summary>
        /// Replaces the audience rows with the roles given. An empty list leaves
        /// none, which the reader treats as "everyone".
        /// </summary>
        private void ApplyAudience(int newsId, List<string>? audience, IReadOnlyCollection<NewsTargetRole> existing)
        {
            if (existing.Count > 0)
            {
                _context.NewsTargetRoles.RemoveRange(existing);
            }

            foreach (var role in (audience ?? new List<string>())
                     .Select(role => KnownRoles.FirstOrDefault(known =>
                         string.Equals(known, role?.Trim(), StringComparison.OrdinalIgnoreCase)))
                     .Where(role => role != null)
                     .Distinct())
            {
                _context.NewsTargetRoles.Add(new NewsTargetRole { NewsId = newsId, Role = role! });
            }
        }

        /// <summary>Accepts either the category id or its name.</summary>
        private async Task<int?> ResolveTypeIdAsync(NewsRequest request)
        {
            if (request.NewsTypeId != null &&
                await _context.NewsTypes.AnyAsync(type => type.Id == request.NewsTypeId.Value))
            {
                return request.NewsTypeId.Value;
            }

            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                var name = request.Category.Trim();
                var match = await _context.NewsTypes
                    .FirstOrDefaultAsync(type => type.Name == name);

                if (match != null)
                {
                    return match.Id;
                }
            }

            return null;
        }
    }
}
