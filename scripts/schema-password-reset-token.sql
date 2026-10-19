-- Creates dbo.PasswordResetToken, the store behind the password reset flow.
--
-- This is additive: it creates one new table and touches nothing that already
-- exists. It is re-runnable - the table is only created when missing - and it is
-- applied automatically by scripts/restore-localdb.ps1 and by the Docker
-- db-restore service, because restoring the backup drops it again.
--
-- Run on its own with:
--     sqlcmd -S "(localdb)\MSSQLLocalDB" -b -i scripts\schema-password-reset-token.sql
--
-- Only the SHA-256 hash of a token is stored, so a copy of this table cannot be
-- turned back into working reset links.
:on error exit

USE SSS;
GO

IF OBJECT_ID('dbo.PasswordResetToken', 'U') IS NULL
BEGIN
    PRINT 'Creating dbo.PasswordResetToken...';

    CREATE TABLE dbo.PasswordResetToken
    (
        ID        int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_PasswordResetToken PRIMARY KEY,
        UserID    int NOT NULL
            CONSTRAINT FK_PasswordResetToken_UserAccount
            REFERENCES dbo.UserAccount (ID),
        TokenHash varchar(255) NOT NULL,
        ExpiresAt datetime NOT NULL,
        UsedAt    datetime NULL
    );

    -- Every lookup is by token hash, and a hash maps to one token.
    CREATE UNIQUE INDEX UQ_PasswordResetToken_TokenHash
        ON dbo.PasswordResetToken (TokenHash);

    -- Used when invalidating a user's outstanding tokens.
    CREATE INDEX IX_PasswordResetToken_UserID
        ON dbo.PasswordResetToken (UserID);
END
ELSE
BEGIN
    PRINT 'dbo.PasswordResetToken already exists.';
END
GO

PRINT '';
PRINT 'dbo.PasswordResetToken columns:';
SELECT c.name AS ColumnName, t.name AS DataType, c.max_length AS MaxLengthBytes, c.is_nullable AS IsNullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.PasswordResetToken')
ORDER BY c.column_id;
GO
