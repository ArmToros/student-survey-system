using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class NewsTargetRole
{
    public int NewsId { get; set; }

    public string Role { get; set; } = null!;

    public virtual News News { get; set; } = null!;
}
