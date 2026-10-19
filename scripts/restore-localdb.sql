-- Restores "new database\SSS.bak" into the SQL Server LocalDB instance on Windows.
-- Used when Docker Desktop is not installed; scripts/restore.sql is the Docker equivalent.
-- Run scripts/seed.sql afterwards to add the demo accounts.
--
-- Call it through scripts/restore-localdb.ps1, or directly:
--   sqlcmd -S "(localdb)\MSSQLLocalDB" -b -i scripts\restore-localdb.sql ^
--          -v BackupFile="D:\path\to\new database\SSS.bak" BackupSet="7"
--
-- SSS.bak holds several appended backup sets, so the set has to be named
-- explicitly: without WITH FILE the server restores the FIRST (oldest) set.
-- Set 7 (finished 2026-05-17 17:04) is the newest set in the backup file.
:on error exit

USE master;
GO

IF DB_ID('SSS') IS NOT NULL
BEGIN
    ALTER DATABASE SSS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE SSS;
END
GO

DECLARE @BackupFile nvarchar(260) = N'$(BackupFile)';
DECLARE @BackupSet int = $(BackupSet);

-- LocalDB keeps its data files under the user profile; ask the server where.
DECLARE @DataDir nvarchar(260) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260));

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
           'REPLACE, RECOVERY, STATS = 10, ' +
           'MOVE ''' + @MdfName + ''' TO ''' + @DataDir + 'SSS.mdf'', ' +
           'MOVE ''' + @LdfName + ''' TO ''' + @DataDir + 'SSS_log.ldf'';'

PRINT @Sql;
EXEC(@Sql);
GO

ALTER DATABASE SSS SET MULTI_USER;
GO

PRINT 'Restored database SSS into LocalDB.';
GO
