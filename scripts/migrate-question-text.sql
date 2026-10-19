-- NOT APPLIED. Review before running anything from this file.
--
-- dbo.Question stores no question text. Its columns are QuestionID, SurveyID and
-- Answear, and the Answear values look like answers ("A", "B", "The process of
-- converting source code into machine code") rather than questions. The React app
-- needs a question label, a question type and a list of options, so the API
-- currently works around the gap: it shows Answear as the label and derives the
-- options from the values already present in dbo.SurveyAnswer.
--
-- This script closes that gap properly. It is additive: it only adds nullable
-- columns and never reads, rewrites or drops the existing data, and the misspelled
-- Answear column is left exactly as it is so nothing that depends on it breaks.
--
-- It is re-runnable - each column is added only when missing.
--
-- To apply it (only once the database owner agrees):
--     sqlcmd -S "(localdb)\MSSQLLocalDB" -b -i scripts\migrate-question-text.sql
--
-- After applying, SurveysController can be switched to read QuestionText,
-- QuestionType and Options instead of deriving them.
:on error exit

USE SSS;
GO

IF COL_LENGTH('dbo.Question', 'QuestionText') IS NULL
BEGIN
    PRINT 'Adding dbo.Question.QuestionText...';
    ALTER TABLE dbo.Question ADD QuestionText nvarchar(1000) NULL;
END
ELSE
BEGIN
    PRINT 'dbo.Question.QuestionText already exists.';
END
GO

IF COL_LENGTH('dbo.Question', 'QuestionType') IS NULL
BEGIN
    PRINT 'Adding dbo.Question.QuestionType...';
    -- Values used by the React form: text, single-choice, multiple-choice, checkbox, rating.
    ALTER TABLE dbo.Question ADD QuestionType varchar(20) NULL;
END
ELSE
BEGIN
    PRINT 'dbo.Question.QuestionType already exists.';
END
GO

IF COL_LENGTH('dbo.Question', 'Options') IS NULL
BEGIN
    PRINT 'Adding dbo.Question.Options...';
    -- A JSON array of option labels, for example: ["Agree","Neutral","Disagree"]
    ALTER TABLE dbo.Question ADD Options nvarchar(max) NULL;
END
ELSE
BEGIN
    PRINT 'dbo.Question.Options already exists.';
END
GO

-- Optional backfill, commented out on purpose. It would copy the existing answer
-- options of each question into the new Options column and mark those questions as
-- single choice, which is what the API infers today. Uncomment only after deciding
-- that this is the wanted interpretation of the data.
--
-- UPDATE q
--    SET q.QuestionType = 'single-choice',
--        q.Options = (
--            SELECT '[' + STRING_AGG('"' + STRING_ESCAPE(a.Answer, 'json') + '"', ',') + ']'
--            FROM (SELECT DISTINCT Answer FROM dbo.SurveyAnswer WHERE QuestionID = q.QuestionID AND Answer IS NOT NULL) a
--        )
--   FROM dbo.Question q
--  WHERE q.QuestionType IS NULL
--    AND EXISTS (SELECT 1 FROM dbo.SurveyAnswer WHERE QuestionID = q.QuestionID);
-- GO

PRINT '';
PRINT 'dbo.Question columns after migration:';
SELECT c.name AS ColumnName, t.name AS DataType, c.is_nullable AS IsNullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.Question')
ORDER BY c.column_id;
GO
