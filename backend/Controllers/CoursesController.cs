using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers
{
    /// <summary>
    /// Extra classes a lecturer runs and students opt into.
    ///
    /// A course belongs to one lecturer (dbo.Course.LecturerID) and a lecturer may
    /// run many. Enrolment is the dbo.StudentCourse join, which EF reaches through
    /// StudentDatum.Courses.
    ///
    /// The ten courses restored from the backup have no lecturer. They are left
    /// visible to everyone but cannot be edited or deleted here, because nothing
    /// records who owns them.
    ///
    /// Who may do what, taken from the token rather than the request body:
    ///   anyone signed in  list courses
    ///   lecturer, admin   create
    ///   owner, admin      update and delete
    ///   student           join and leave, always themselves
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CoursesController : ControllerBase
    {
        private readonly SssContext _context;

        public CoursesController(SssContext context)
        {
            _context = context;
        }

        private int? CallerId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        private bool CallerIsAdmin =>
            string.Equals(User.FindFirstValue(ClaimTypes.Role), "Admin", StringComparison.OrdinalIgnoreCase);

        public class CourseRequest
        {
            public string? CourseNumber { get; set; }
            public string Name { get; set; } = "";
            public string? Schedule { get; set; }
            public string? Room { get; set; }
            public string? Focus { get; set; }
        }

        [HttpGet]
        public async Task<ActionResult> GetAll([FromQuery] bool mine = false)
        {
            var callerId = CallerId;

            var query = _context.Courses.AsQueryable();

            if (mine && callerId != null)
            {
                query = query.Where(course => course.LecturerId == callerId.Value);
            }

            var courses = await query
                // Courses created here come first, newest first; the backup's
                // undated ones follow. DateTime.MinValue cannot be used as a
                // fallback: year 1 is outside SQL Server's datetime range.
                .OrderByDescending(course => course.CreatedAt.HasValue)
                .ThenByDescending(course => course.CreatedAt)
                .ThenBy(course => course.CourseNumber)
                .Select(course => new
                {
                    id = course.Id,
                    courseNumber = course.CourseNumber,
                    name = course.CourseName,
                    schedule = course.Schedule,
                    room = course.Room,
                    focus = course.Focus,
                    createdAt = course.CreatedAt,
                    lecturerId = course.LecturerId,
                    students = course.Students.Count,
                    // Set per caller below; the join cannot be filtered by a
                    // local variable inside this projection on every provider.
                    enrolled = course.Students.Any(student => student.Id == callerId)
                })
                .ToListAsync();

            var lecturerIds = courses
                .Where(course => course.lecturerId != null)
                .Select(course => course.lecturerId!.Value)
                .Distinct()
                .ToList();

            var lecturers = await _context.UserAccounts
                .Where(user => lecturerIds.Contains(user.Id))
                .Select(user => new { user.Id, Name = ((user.FirstName ?? "") + " " + (user.LastName ?? "")).Trim() })
                .ToDictionaryAsync(user => user.Id, user => user.Name);

            return Ok(courses.Select(course => new
            {
                course.id,
                course.courseNumber,
                course.name,
                course.schedule,
                course.room,
                course.focus,
                course.createdAt,
                course.lecturerId,
                lecturerName = course.lecturerId != null && lecturers.ContainsKey(course.lecturerId.Value)
                    ? lecturers[course.lecturerId.Value]
                    : null,
                course.students,
                course.enrolled,
                canManage = course.lecturerId != null && (CallerIsAdmin || course.lecturerId == callerId)
            }));
        }

        [HttpPost]
        [Authorize(Policy = "Staff")]
        public async Task<ActionResult> Create([FromBody] CourseRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "A course name is required" });
            }

            var callerId = CallerId;
            if (callerId == null)
            {
                return BadRequest(new { message = "A user account is required to create a course" });
            }

            // CourseNumber is NOT NULL and unique, so one is generated when the
            // lecturer does not supply it.
            var courseNumber = request.CourseNumber?.Trim();
            if (string.IsNullOrWhiteSpace(courseNumber))
            {
                courseNumber = await GenerateCourseNumberAsync();
            }
            else if (await _context.Courses.AnyAsync(course => course.CourseNumber == courseNumber))
            {
                return Conflict(new { message = $"Course code '{courseNumber}' is already in use." });
            }

            var course = new Course
            {
                // Course.ID is not an identity column, so the key is allocated here.
                Id = await _context.Courses.AnyAsync()
                    ? await _context.Courses.MaxAsync(item => item.Id) + 1
                    : 1,
                CourseNumber = Truncate(courseNumber, 10)!,
                CourseName = Truncate(request.Name.Trim(), 100),
                LecturerId = callerId.Value,
                Schedule = Truncate(request.Schedule?.Trim(), 200),
                Room = Truncate(request.Room?.Trim(), 200),
                Focus = Truncate(request.Focus?.Trim(), 600),
                CreatedAt = DateTime.UtcNow
            };

            _context.Courses.Add(course);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { id = course.Id }, new
            {
                id = course.Id,
                courseNumber = course.CourseNumber,
                name = course.CourseName
            });
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = "Staff")]
        public async Task<ActionResult> Update(int id, [FromBody] CourseRequest request)
        {
            var course = await _context.Courses.FirstOrDefaultAsync(item => item.Id == id);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            if (!CanManage(course))
            {
                return Forbid();
            }

            if (request != null && !string.IsNullOrWhiteSpace(request.Name))
            {
                course.CourseName = Truncate(request.Name.Trim(), 100);
            }

            course.Schedule = Truncate(request?.Schedule?.Trim(), 200);
            course.Room = Truncate(request?.Room?.Trim(), 200);
            course.Focus = Truncate(request?.Focus?.Trim(), 600);

            await _context.SaveChangesAsync();

            return Ok(new { id = course.Id, name = course.CourseName });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = "Staff")]
        public async Task<ActionResult> Delete(int id)
        {
            var course = await _context.Courses
                .Include(item => item.Students)
                .FirstOrDefaultAsync(item => item.Id == id);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            if (!CanManage(course))
            {
                return Forbid();
            }

            // Clearing the collection removes the StudentCourse rows, which the
            // foreign key would otherwise refuse to orphan.
            course.Students.Clear();
            _context.Courses.Remove(course);
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Course deleted" });
        }

        /// <summary>Joins the signed-in student to a course. Always themselves.</summary>
        [HttpPost("{id:int}/enrollment")]
        public async Task<ActionResult> Join(int id)
        {
            var callerId = CallerId;
            if (callerId == null)
            {
                return BadRequest(new { message = "A user account is required to join a course" });
            }

            var course = await _context.Courses
                .Include(item => item.Students)
                .FirstOrDefaultAsync(item => item.Id == id);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Enrolment hangs off StudentData, which only exists for students.
            var student = await _context.StudentData.FirstOrDefaultAsync(item => item.Id == callerId.Value);
            if (student == null)
            {
                return BadRequest(new { message = "Only student accounts can join a course." });
            }

            if (course.Students.Any(item => item.Id == student.Id))
            {
                return Conflict(new { message = "You have already joined this course." });
            }

            course.Students.Add(student);
            await _context.SaveChangesAsync();

            return Ok(new { id, enrolled = true, students = course.Students.Count });
        }

        [HttpDelete("{id:int}/enrollment")]
        public async Task<ActionResult> Leave(int id)
        {
            var callerId = CallerId;
            if (callerId == null)
            {
                return BadRequest(new { message = "A user account is required to leave a course" });
            }

            var course = await _context.Courses
                .Include(item => item.Students)
                .FirstOrDefaultAsync(item => item.Id == id);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            var student = course.Students.FirstOrDefault(item => item.Id == callerId.Value);
            if (student == null)
            {
                return Ok(new { id, enrolled = false, students = course.Students.Count });
            }

            course.Students.Remove(student);
            await _context.SaveChangesAsync();

            return Ok(new { id, enrolled = false, students = course.Students.Count });
        }

        private bool CanManage(Course course) =>
            course.LecturerId != null && (CallerIsAdmin || course.LecturerId == CallerId);

        /// <summary>
        /// Builds a free course code such as EXTRA-07. CourseNumber is unique and
        /// only ten characters wide, so the suffix is kept short.
        /// </summary>
        private async Task<string> GenerateCourseNumberAsync()
        {
            var used = await _context.Courses
                .Select(course => course.CourseNumber)
                .ToListAsync();

            for (var index = 1; index < 1000; index++)
            {
                var candidate = $"EXTRA-{index:D2}";
                if (!used.Contains(candidate))
                {
                    return candidate;
                }
            }

            return "EXTRA-" + DateTime.UtcNow.ToString("HHmmss");
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
