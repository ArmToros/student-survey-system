using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// An extra class a lecturer runs and students opt into: dbo.Course.
///
/// LecturerID, Schedule, Room, Focus and CreatedAt were added by
/// scripts/schema-authoring.sql. The ten courses from the backup have no
/// lecturer and keep LecturerID null - they are institutional, not run by one
/// person - so "my courses" means the rows that do name a lecturer.
///
/// Enrolment is the StudentCourse join, reached through Students.
/// </summary>
public partial class Course
{
    public int Id { get; set; }

    public string CourseNumber { get; set; } = null!;

    public string? CourseName { get; set; }

    /// <summary>UserAccount.ID of the lecturer running it; null for the backup's courses.</summary>
    public int? LecturerId { get; set; }

    /// <summary>When it meets, as free text, for example "09:00 Mondays".</summary>
    public string? Schedule { get; set; }

    public string? Room { get; set; }

    /// <summary>A one-line description of what the class covers.</summary>
    public string? Focus { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<StudentDatum> Students { get; set; } = new List<StudentDatum>();
}
