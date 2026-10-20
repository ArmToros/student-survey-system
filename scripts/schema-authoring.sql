-- Adds the columns the survey authoring and profile features need.
--
-- Supersedes scripts/migrate-question-text.sql, which added only the three
-- Question columns and was left unapplied.
--
-- Everything here is ADDITIVE and RE-RUNNABLE: it only adds nullable columns
-- (and one bit column with a default), and never reads, rewrites or drops
-- existing data. The misspelled dbo.Question.Answear column is deliberately
-- left exactly as it is, so anything still reading it keeps working. Nothing is
-- backfilled: existing rows keep NULL in the new columns and the API falls back
-- to its old behaviour for them.
--
-- scripts/restore-localdb.ps1 runs this after every restore, because a restore
-- recreates the database from the backup and would otherwise drop these columns.
--
-- Why each column exists, in terms of what was broken without it:
--   Question.QuestionText   the only text column was Answear, which holds answer
--                           fragments ("A", "B"), so questions displayed as "A"
--   Question.QuestionType   the type chosen when authoring was discarded, so
--                           every question behaved as free text
--   Question.Options        options were derived from answers already recorded,
--                           so a question changed shape as responses came in
--   Question.IsRequired     "Required question" in the authoring UI went nowhere
--   Survey.Category         the category selector had nothing to write to
--   Survey.CreatedAt        the results page could only show a dash for dates
--   Survey.IsClosed/ClosedAt  nothing could ever be "completed", so the
--                           dashboard always reported 0
--   UserAccount.JoinDate    "Join Date" on the account page had no source
--   UserAccount.PhotoUrl    somewhere to record an avatar once uploads exist
--   SurveySession.SubmittedAt  responses carried no timestamp at all
:on error exit

USE SSS;
GO

PRINT 'dbo.Question';
GO

IF COL_LENGTH('dbo.Question', 'QuestionText') IS NULL
BEGIN
    PRINT '  adding QuestionText';
    ALTER TABLE dbo.Question ADD QuestionText nvarchar(1000) NULL;
END
ELSE PRINT '  QuestionText already present';
GO

IF COL_LENGTH('dbo.Question', 'QuestionType') IS NULL
BEGIN
    PRINT '  adding QuestionType';
    -- Values the React form uses: text, single-choice, multiple-choice, checkbox, rating.
    ALTER TABLE dbo.Question ADD QuestionType varchar(20) NULL;
END
ELSE PRINT '  QuestionType already present';
GO

IF COL_LENGTH('dbo.Question', 'Options') IS NULL
BEGIN
    PRINT '  adding Options';
    -- A JSON array of option labels, for example: ["Agree","Neutral","Disagree"]
    ALTER TABLE dbo.Question ADD Options nvarchar(max) NULL;
END
ELSE PRINT '  Options already present';
GO

IF COL_LENGTH('dbo.Question', 'IsRequired') IS NULL
BEGIN
    PRINT '  adding IsRequired';
    ALTER TABLE dbo.Question ADD IsRequired bit NULL;
END
ELSE PRINT '  IsRequired already present';
GO

PRINT 'dbo.Survey';
GO

IF COL_LENGTH('dbo.Survey', 'Category') IS NULL
BEGIN
    PRINT '  adding Category';
    ALTER TABLE dbo.Survey ADD Category nvarchar(50) NULL;
END
ELSE PRINT '  Category already present';
GO

IF COL_LENGTH('dbo.Survey', 'CreatedAt') IS NULL
BEGIN
    PRINT '  adding CreatedAt';
    ALTER TABLE dbo.Survey ADD CreatedAt datetime NULL;
END
ELSE PRINT '  CreatedAt already present';
GO

IF COL_LENGTH('dbo.Survey', 'ClosedAt') IS NULL
BEGIN
    PRINT '  adding ClosedAt';
    ALTER TABLE dbo.Survey ADD ClosedAt datetime NULL;
END
ELSE PRINT '  ClosedAt already present';
GO

-- NOT NULL with a default is safe to add to an existing table: SQL Server fills
-- the existing rows with 0, which is the correct answer for every survey today.
IF COL_LENGTH('dbo.Survey', 'IsClosed') IS NULL
BEGIN
    PRINT '  adding IsClosed';
    ALTER TABLE dbo.Survey ADD IsClosed bit NOT NULL CONSTRAINT DF_Survey_IsClosed DEFAULT (0);
END
ELSE PRINT '  IsClosed already present';
GO

PRINT 'dbo.UserAccount';
GO

IF COL_LENGTH('dbo.UserAccount', 'JoinDate') IS NULL
BEGIN
    PRINT '  adding JoinDate';
    ALTER TABLE dbo.UserAccount ADD JoinDate datetime NULL;
END
ELSE PRINT '  JoinDate already present';
GO

IF COL_LENGTH('dbo.UserAccount', 'PhotoUrl') IS NULL
BEGIN
    PRINT '  adding PhotoUrl';
    ALTER TABLE dbo.UserAccount ADD PhotoUrl nvarchar(400) NULL;
END
ELSE PRINT '  PhotoUrl already present';
GO

PRINT 'dbo.SurveySession';
GO

IF COL_LENGTH('dbo.SurveySession', 'SubmittedAt') IS NULL
BEGIN
    PRINT '  adding SubmittedAt';
    ALTER TABLE dbo.SurveySession ADD SubmittedAt datetime NULL;
END
ELSE PRINT '  SubmittedAt already present';
GO

PRINT '';
PRINT 'Columns now present:';
SELECT OBJECT_NAME(c.object_id) AS TableName, c.name AS ColumnName, t.name AS DataType, c.is_nullable AS IsNullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id IN (OBJECT_ID('dbo.Question'), OBJECT_ID('dbo.Survey'), OBJECT_ID('dbo.SurveySession'))
   OR (c.object_id = OBJECT_ID('dbo.UserAccount') AND c.name IN ('JoinDate', 'PhotoUrl'))
ORDER BY TableName, c.column_id;
GO
