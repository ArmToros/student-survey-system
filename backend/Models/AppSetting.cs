using System;

namespace backend.Models;

/// <summary>
/// A small key/value store for things an admin can change that are not worth a
/// column of their own: dbo.AppSetting.
///
/// First use is SupportBotName, the name shown on the support bot conversation.
/// </summary>
public partial class AppSetting
{
    public string SettingKey { get; set; } = null!;

    public string? Value { get; set; }

    public int? UpdatedBy { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
