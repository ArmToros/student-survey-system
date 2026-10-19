using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // Public on purpose: used by the restore scripts and the README to check the stack.
    [AllowAnonymous]
    public class HealthController : ControllerBase
    {
        private readonly SssContext _context;

        public HealthController(SssContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult> Get()
        {
            var canConnect = await _context.Database.CanConnectAsync();

            if (!canConnect)
            {
                return StatusCode(503, new
                {
                    status = "unavailable",
                    database = "SSS",
                    canConnect
                });
            }

            return Ok(new
            {
                status = "ok",
                database = "SSS",
                canConnect,
                counts = new
                {
                    users = await _context.UserAccounts.CountAsync(),
                    surveys = await _context.Surveys.CountAsync(),
                    news = await _context.News.CountAsync(),
                    courses = await _context.Courses.CountAsync()
                }
            });
        }
    }
}
