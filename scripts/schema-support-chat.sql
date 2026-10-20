-- Support chat: the preset questions people pick from, and the two flags that
-- let each side remove a finished conversation from their own list.
--
-- How the feature works, so the columns make sense:
--   * Admins maintain a list of common questions with ready-made answers.
--     These are shown inside one conversation with the support bot, whose name
--     admins can change too - it lives in dbo.AppSetting under SupportBotName.
--     Picking a question shows its answer straight away and starts nothing.
--   * Anything not on that list goes through "Other": the question is assigned
--     to an admin, which opens a dbo.Chat and writes the first dbo.ChatMessage
--     with IsQuestion set. From there it is an ordinary back-and-forth.
--   * Either side can close the conversation, and either side can then remove
--     it from their own list without destroying it for the other. That is what
--     HiddenByAuthor and HiddenByAdmin record; nothing is deleted.
--
-- dbo.Chat and dbo.ChatMessage already exist in the backup and are untouched
-- here beyond those two flags. They were called Survey and SurveyMessage in an
-- older backup set, which is why Chat's primary key is still PK__Survey__...
--
-- Additive and re-runnable. Applied after every restore by
-- scripts/restore-localdb.ps1 and by the Docker db-restore service, because
-- restoring the backup drops anything not in it.
:on error exit

USE SSS;
GO

IF OBJECT_ID('dbo.PresetQuestion', 'U') IS NULL
BEGIN
    PRINT 'Creating dbo.PresetQuestion...';

    CREATE TABLE dbo.PresetQuestion
    (
        ID        int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_PresetQuestion PRIMARY KEY,
        Question  nvarchar(400) NOT NULL,
        Answer    nvarchar(max) NOT NULL,
        -- Lower sorts first; ties fall back to the question text.
        SortOrder int NOT NULL
            CONSTRAINT DF_PresetQuestion_SortOrder DEFAULT (0),
        -- Retiring a question keeps it out of the list without losing the
        -- wording, which is kinder than deleting it outright.
        IsActive  bit NOT NULL
            CONSTRAINT DF_PresetQuestion_IsActive DEFAULT (1),
        CreatedBy int NULL
            CONSTRAINT FK_PresetQuestion_UserAccount
            REFERENCES dbo.UserAccount (ID),
        CreatedAt datetime NULL,
        UpdatedAt datetime NULL
    );

    -- The list is read on every visit to the chat page, always in this order.
    CREATE INDEX IX_PresetQuestion_Active
        ON dbo.PresetQuestion (IsActive, SortOrder);
END
ELSE
BEGIN
    PRINT 'dbo.PresetQuestion already exists.';
END
GO

IF OBJECT_ID('dbo.AppSetting', 'U') IS NULL
BEGIN
    PRINT 'Creating dbo.AppSetting...';

    -- A small key/value store for things an admin can change that are not worth
    -- a column of their own. First use: what the support bot is called.
    CREATE TABLE dbo.AppSetting
    (
        SettingKey nvarchar(100) NOT NULL
            CONSTRAINT PK_AppSetting PRIMARY KEY,
        Value      nvarchar(400) NULL,
        UpdatedBy  int NULL
            CONSTRAINT FK_AppSetting_UserAccount
            REFERENCES dbo.UserAccount (ID),
        UpdatedAt  datetime NULL
    );
END
ELSE
BEGIN
    PRINT 'dbo.AppSetting already exists.';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AppSetting WHERE SettingKey = N'SupportBotName')
BEGIN
    PRINT 'Setting the default support bot name...';
    INSERT INTO dbo.AppSetting (SettingKey, Value, UpdatedAt)
    VALUES (N'SupportBotName', N'Bot AI', GETDATE());
END
ELSE
BEGIN
    PRINT 'The support bot name is already set; leaving it alone.';
END
GO

PRINT 'dbo.Chat';
GO

IF COL_LENGTH('dbo.Chat', 'HiddenByAuthor') IS NULL
BEGIN
    PRINT '  adding HiddenByAuthor';
    ALTER TABLE dbo.Chat ADD HiddenByAuthor bit NOT NULL
        CONSTRAINT DF_Chat_HiddenByAuthor DEFAULT (0);
END
ELSE PRINT '  HiddenByAuthor already present';
GO

IF COL_LENGTH('dbo.Chat', 'HiddenByAdmin') IS NULL
BEGIN
    PRINT '  adding HiddenByAdmin';
    ALTER TABLE dbo.Chat ADD HiddenByAdmin bit NOT NULL
        CONSTRAINT DF_Chat_HiddenByAdmin DEFAULT (0);
END
ELSE PRINT '  HiddenByAdmin already present';
GO

-- A starting set, so the page is not empty before an admin writes any. Only
-- inserted when the table is empty, so edits and deletions are never undone.
IF NOT EXISTS (SELECT 1 FROM dbo.PresetQuestion)
BEGIN
    PRINT 'Adding the starter questions...';

    INSERT INTO dbo.PresetQuestion (Question, Answer, SortOrder, CreatedAt)
    VALUES
        (N'How do I reset my password?',
         N'Choose "Forgot password?" on the sign-in page and enter your university address. A reset link arrives by email and is valid for 30 minutes. The link can only be used once.',
         10, GETDATE()),
        (N'How do I join a course?',
         N'Open the Courses page from the top menu. It lists every class on offer, including the extra sessions lecturers run. Press "Join course" on the one you want; press "Leave course" to drop it again.',
         20, GETDATE()),
        (N'Where do I find my surveys?',
         N'The Dashboard shows the most recent surveys, and "Browse Surveys" lists all of them. Open one and press "Take Survey". Each survey can be answered once.',
         30, GETDATE()),
        (N'Who can see my survey answers?',
         N'Answers are shown to admins and lecturers as totals per question, never attached to your name in the results view.',
         40, GETDATE()),
        (N'How do I change the language or theme?',
         N'Open Settings from the account menu and use the Appearance tab. Your choice is saved to your account, so it follows you to other devices.',
         50, GETDATE());
END
ELSE
BEGIN
    PRINT 'dbo.PresetQuestion already has questions; leaving them alone.';
END
GO

PRINT '';
PRINT 'dbo.PresetQuestion columns:';
SELECT c.name AS ColumnName, t.name AS DataType, c.is_nullable AS IsNullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.PresetQuestion')
ORDER BY c.column_id;
GO
