using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class LecturerDatum
{
    public int Id { get; set; }

    public string? Department { get; set; }

    public virtual UserAccount IdNavigation { get; set; } = null!;
}
