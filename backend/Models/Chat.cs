using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// A support conversation between a student and an admin: dbo.Chat.
/// This table used to be called Survey (its primary key is still named
/// PK__Survey__...), which is why the original scaffolded model mapped the
/// survey feature onto it. Real surveys live in <see cref="Survey"/>.
/// </summary>
public partial class Chat
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public int CreatedBy { get; set; }

    public int AssignedAdmin { get; set; }

    public bool? IsClosed { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public virtual UserAccount AssignedAdminNavigation { get; set; } = null!;

    public virtual UserAccount CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
}
