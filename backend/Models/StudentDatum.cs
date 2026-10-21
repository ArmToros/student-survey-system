using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class StudentDatum
{
    public int Id { get; set; }

    public string? StudentId { get; set; }

    public string? Major { get; set; }

    /// <summary>
    /// The stored year. Only a fallback now: nothing advances it, so it froze at
    /// whatever the backup held. <see cref="StartYear"/> is what the API uses.
    /// </summary>
    public int? AcademicYear { get; set; }

    /// <summary>The September they started, for example 2023.</summary>
    public int? StartYear { get; set; }

    /// <summary>Bachelor, Master or PhD.</summary>
    public string? Degree { get; set; }

    public virtual UserAccount IdNavigation { get; set; } = null!;

    public virtual ICollection<Course> Courses { get; set; } = new List<Course>();
}
