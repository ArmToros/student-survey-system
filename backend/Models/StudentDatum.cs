using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class StudentDatum
{
    public int Id { get; set; }

    public string? StudentId { get; set; }

    public string? Major { get; set; }

    public int? AcademicYear { get; set; }

    public virtual UserAccount IdNavigation { get; set; } = null!;

    public virtual ICollection<Course> Courses { get; set; } = new List<Course>();
}
