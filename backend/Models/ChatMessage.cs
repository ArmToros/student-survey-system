using System;
using System.Collections.Generic;

namespace backend.Models;

/// <summary>
/// One message in a support conversation: dbo.ChatMessage (formerly SurveyMessage).
/// IsQuestion marks a message written by the person who opened the conversation.
/// </summary>
public partial class ChatMessage
{
    public int Id { get; set; }

    public int ChatId { get; set; }

    public int SentBy { get; set; }

    public string MessageText { get; set; } = null!;

    public DateTime? SentAt { get; set; }

    public bool IsQuestion { get; set; }

    public virtual Chat Chat { get; set; } = null!;

    public virtual UserAccount SentByNavigation { get; set; } = null!;
}
