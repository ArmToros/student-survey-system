using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

            return Ok(new
            {
                stats = new
                {
                    totalUsers = await _context.UserAccounts.CountAsync(),
                    totalSurveys,
                    activeSurveys = totalSurveys - closedSurveys,
                    completedSurveys = closedSurveys,
                    totalResponses
                },
                recentSurveys
            });
        }
    }
}
