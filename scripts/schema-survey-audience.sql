-- Who a survey is for.
--
-- News has had dbo.NewsTargetRole since the backup: one row per role a news
-- item is aimed at, and the API already filters on it. Surveys had no
-- equivalent, so every survey was shown to everybody. This adds the matching
-- table, deliberately shaped the same way so the two features read alike.
--
-- A survey with NO rows here is for everyone. That is what keeps this change
-- backward compatible: the surveys already in the database get no rows and
-- carry on being visible to all, rather than vanishing the moment the filter
-- is switched on.
--
-- The audience is enforced on submission as well as used for filtering, so
-- somebody outside it cannot answer by going straight to the URL.
--
-- Additive and re-runnable. Applied after every restore by
-- scripts/restore-localdb.ps1 and by the Docker db-restore service.
:on error exit

USE SSS;
GO

IF OBJECT_ID('dbo.SurveyTargetRole', 'U') IS NULL
BEGIN
    PRINT 'Creating dbo.SurveyTargetRole...';

    CREATE TABLE dbo.SurveyTargetRole
    (
        SurveyID int NOT NULL
            CONSTRAINT FK_SurveyTargetRole_Survey
            REFERENCES dbo.Survey (SurveyID),
        -- 'Admin', 'Lecturer' or 'Student', matching dbo.NewsTargetRole.Role
        -- and the capitalisation used in dbo.UserAccount.Role.
        Role nvarchar(20) NOT NULL,
        CONSTRAINT PK_SurveyTargetRole PRIMARY KEY (SurveyID, Role)
    );

    -- Every list of surveys filters on this, per signed-in role.
    CREATE INDEX IX_SurveyTargetRole_Role
        ON dbo.SurveyTargetRole (Role);
END
ELSE
BEGIN
    PRINT 'dbo.SurveyTargetRole already exists.';
END
GO

PRINT '';
PRINT 'Surveys and their audience (no rows = everyone):';
SELECT s.SurveyID,
       LEFT(s.Topic, 40) AS Topic,
       ISNULL(STUFF((SELECT ', ' + t.Role
                     FROM dbo.SurveyTargetRole t
                     WHERE t.SurveyID = s.SurveyID
                     ORDER BY t.Role
                     FOR XML PATH('')), 1, 2, ''), '(everyone)') AS Audience
FROM dbo.Survey s
ORDER BY s.SurveyID;
GO
