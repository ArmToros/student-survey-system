using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class Course
{
    public int Id { get; set; }

    public string CourseNumber { get; set; } = null!;

    public string? CourseName { get; set; }

    public virtual ICollection<StudentDatum> Students { get; set; } = new List<StudentDatum>();
}
