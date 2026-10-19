using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        [HttpGet]
        public async Task<ActionResult> GetAll([FromQuery] string? role)
        {
            var query = _context.News
                .Include(item => item.NewsType)
                .Include(item => item.CreatedByNavigation)
                .Include(item => item.NewsTargetRoles)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(role))
            {
                query = query.Where(item => !item.NewsTargetRoles.Any() || item.NewsTargetRoles.Any(target => target.Role == role));
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
                    views = 0,
                    comments = 0,
                    featured = item.Id % 2 == 1
                })
                .ToListAsync();

            return Ok(news);
        }
    }
}
