using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class News
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public string Content { get; set; } = null!;

    public int NewsTypeId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public int? CreatedBy { get; set; }

    public virtual UserAccount? CreatedByNavigation { get; set; }

    public virtual ICollection<NewsTargetRole> NewsTargetRoles { get; set; } = new List<NewsTargetRole>();

    public virtual NewsType NewsType { get; set; } = null!;
}
