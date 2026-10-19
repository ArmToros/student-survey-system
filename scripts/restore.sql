-- Restores /var/opt/mssql/backup/SSS.bak into the database SSS (Docker / Linux paths).
-- The restored backup already contains real accounts, surveys and news, so there is
-- nothing to seed afterwards; scripts/seed-dev-data.sql is the separate path for
-- machines that do not have the backup at all.
--
-- SSS.bak holds several appended backup sets, so the set has to be named
-- explicitly: without WITH FILE the server restores the FIRST (oldest) set.
-- Set 7 (finished 2026-05-17 17:04) is the newest set in the backup file.
:on error exit

USE master;
GO

DECLARE @BackupFile nvarchar(260) = N'/var/opt/mssql/backup/SSS.bak';
DECLARE @BackupSet int = 7;

IF DB_ID('SSS') IS NOT NULL
BEGIN
    ALTER DATABASE SSS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE SSS;
END
GO

DECLARE @BackupFile nvarchar(260) = N'/var/opt/mssql/backup/SSS.bak';
DECLARE @BackupSet int = 7;
DECLARE @DataDir nvarchar(260) = N'/var/opt/mssql/data/';

DECLARE @Files TABLE (
    LogicalName nvarchar(128),
    PhysicalName nvarchar(260),
    Type char(1),
    FileGroupName nvarchar(128),
    Size numeric(20,0),
    MaxSize numeric(20,0),
    FileId bigint,
    CreateLSN numeric(25,0),
    DropLSN numeric(25,0),
    UniqueId uniqueidentifier,
    ReadOnlyLSN numeric(25,0),
    ReadWriteLSN numeric(25,0),
    BackupSizeInBytes bigint,
    SourceBlockSize int,
    FileGroupId int,
    LogGroupGUID uniqueidentifier,
    DifferentialBaseLSN numeric(25,0),
    DifferentialBaseGUID uniqueidentifier,
    IsReadOnly bit,
    IsPresent bit,
    TDEThumbprint varbinary(32),
    SnapshotUrl nvarchar(360)
);

PRINT 'Reading file list of backup set ' + CAST(@BackupSet AS nvarchar(10)) + ' in ' + @BackupFile;
INSERT INTO @Files
EXEC('RESTORE FILELISTONLY FROM DISK=''' + @BackupFile + ''' WITH FILE = ' + @BackupSet);

DECLARE @MdfName nvarchar(128), @LdfName nvarchar(128);
SELECT TOP (1) @MdfName = LogicalName FROM @Files WHERE Type = 'D';
SELECT TOP (1) @LdfName = LogicalName FROM @Files WHERE Type = 'L';

IF @MdfName IS NULL OR @LdfName IS NULL
BEGIN
    THROW 51000, 'Could not find data/log logical file names inside SSS.bak.', 1;
END

DECLARE @Sql nvarchar(max);
SET @Sql = 'RESTORE DATABASE SSS FROM DISK=''' + @BackupFile + ''' WITH FILE = ' + CAST(@BackupSet AS nvarchar(10)) + ', ' +
           'REPLACE, RECOVERY, STATS = 5, ' +
           'MOVE ''' + @MdfName + ''' TO ''' + @DataDir + 'SSS.mdf'', ' +
           'MOVE ''' + @LdfName + ''' TO ''' + @DataDir + 'SSS_log.ldf'';'

PRINT @Sql;
EXEC(@Sql);
GO

ALTER DATABASE SSS SET MULTI_USER;
GO

PRINT 'Restored database SSS.';
GO
