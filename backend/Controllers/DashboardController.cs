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
    public class DashboardController : ControllerBase
    {
        private readonly SssContext _context;

        public DashboardController(SssContext context)
        {
            _context = context;
        }

        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        [HttpGet]
        public async Task<ActionResult> Get()
        {
            var recentSurveys = await _context.Surveys
                .OrderByDescending(survey => survey.SurveyId)
                .Select(survey => new
                {
                    id = survey.SurveyId,
                    title = survey.Topic ?? ("Survey " + survey.SurveyId),
                    responses = survey.SurveySessions.Count,
                    status = survey.IsClosed ? "completed" : "active",
                    createdDate = survey.CreatedAt
                })
                .Take(5)
                .ToListAsync();

            var totalSurveys = await _context.Surveys.CountAsync();
            var closedSurveys = await _context.Surveys.CountAsync(survey => survey.IsClosed);

            // One session is one completed run through a survey, so sessions are responses.
            var totalResponses = await _context.SurveySessions.CountAsync();

            // "Completed" is read on your own dashboard as "how many have I done",
            // not "how many has the university closed" - the admin console is
            // where the system-wide figures belong. Counting distinct surveys
            // rather than sessions, because the backup holds people who answered
            // the same survey twice.
            var callerId = CallerId;
            var myCompleted = callerId == null
                ? 0
                : await _context.SurveySessions
                    .Where(session => session.UserId == callerId.Value)
                    .Select(session => session.SurveyId)
                    .Distinct()
                    .CountAsync();

            return Ok(new
            {
                stats = new
                {
                    totalUsers = await _context.UserAccounts.CountAsync(),
                    totalSurveys,
                    activeSurveys = totalSurveys - closedSurveys,
                    completedSurveys = myCompleted,
                    closedSurveys,
                    totalResponses
                },
                recentSurveys
            });
        }
    }
}
