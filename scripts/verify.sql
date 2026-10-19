-- Verifies a restored SSS database: confirms the expected tables exist and
-- reports how many rows landed in each one.
--
-- This replaced an earlier seed script that inserted demo accounts. That script
-- targeted the older schema in backup set 1 (Survey/SurveyMessage/Timetable) and
-- failed against the current backup, and the restored database already contains
-- real accounts, surveys and news, so nothing needs seeding.
--
-- Run with: sqlcmd -S "(localdb)\MSSQLLocalDB" -b -i scripts\verify.sql
:on error exit

USE SSS;
GO

SET NOCOUNT ON;

PRINT 'Checking expected tables...';

DECLARE @Expected TABLE (TableName sysname);
INSERT INTO @Expected (TableName) VALUES
    ('UserAccount'), ('StudentData'), ('LecturerData'),
    ('Course'), ('StudentCourse'),
    ('News'), ('NewsType'), ('NewsTargetRole'),
    ('Chat'), ('ChatMessage'),
    ('Survey'), ('Question'), ('SurveySession'), ('SurveyAnswer'),
    -- Not in the backup; created by schema-password-reset-token.sql.
    ('PasswordResetToken');

DECLARE @Missing nvarchar(max) = NULL;

SELECT @Missing = STRING_AGG(e.TableName, ', ')
FROM @Expected e
WHERE OBJECT_ID('dbo.' + QUOTENAME(e.TableName), 'U') IS NULL;

IF @Missing IS NOT NULL
BEGIN
    DECLARE @Message nvarchar(2000) =
        N'Restored database is missing expected tables: ' + @Missing +
        N'. The backup set may be wrong - set 7 is the newest and the one the code targets.';
    THROW 51001, @Message, 1;
END

PRINT 'All expected tables are present.';
GO

PRINT '';
PRINT 'Row counts:';

SELECT 'UserAccount' AS TableName, COUNT_BIG(*) AS [Rows] FROM dbo.UserAccount
UNION ALL SELECT 'StudentData',   COUNT_BIG(*) FROM dbo.StudentData
UNION ALL SELECT 'LecturerData',  COUNT_BIG(*) FROM dbo.LecturerData
UNION ALL SELECT 'Course',        COUNT_BIG(*) FROM dbo.Course
UNION ALL SELECT 'StudentCourse', COUNT_BIG(*) FROM dbo.StudentCourse
UNION ALL SELECT 'News',          COUNT_BIG(*) FROM dbo.News
UNION ALL SELECT 'NewsType',      COUNT_BIG(*) FROM dbo.NewsType
UNION ALL SELECT 'Chat',          COUNT_BIG(*) FROM dbo.Chat
UNION ALL SELECT 'ChatMessage',   COUNT_BIG(*) FROM dbo.ChatMessage
UNION ALL SELECT 'Survey',        COUNT_BIG(*) FROM dbo.Survey
UNION ALL SELECT 'Question',      COUNT_BIG(*) FROM dbo.Question
UNION ALL SELECT 'SurveySession', COUNT_BIG(*) FROM dbo.SurveySession
UNION ALL SELECT 'SurveyAnswer',  COUNT_BIG(*) FROM dbo.SurveyAnswer
UNION ALL SELECT 'PasswordResetToken', COUNT_BIG(*) FROM dbo.PasswordResetToken
ORDER BY TableName;
GO
