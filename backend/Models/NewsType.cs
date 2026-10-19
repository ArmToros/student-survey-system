using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class NewsType
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public virtual ICollection<News> News { get; set; } = new List<News>();
}
