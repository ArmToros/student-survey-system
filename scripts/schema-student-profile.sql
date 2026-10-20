-- Student profile fields: what degree they are taking, and when they started.
--
-- dbo.StudentData.AcademicYear is a plain number that nothing ever updates, so
-- it froze at whatever the backup was written with: the students who started in
-- 2021 still say year 3. The year has to advance each 1 September, and a column
-- that something must remember to bump every autumn will drift again.
--
-- So the year is derived instead of stored. StartYear records the September they
-- began, and the API works the current year out from it on every read, which is
-- right every day without anything scheduled. AcademicYear is left in place and
-- used as a fallback for any row with no StartYear.
--
-- Additive and re-runnable. Applied after every restore by
-- scripts/restore-localdb.ps1 and by the Docker db-restore service.
:on error exit

USE SSS;
GO

PRINT 'dbo.StudentData';
GO

IF COL_LENGTH('dbo.StudentData', 'StartYear') IS NULL
BEGIN
    PRINT '  adding StartYear';
    ALTER TABLE dbo.StudentData ADD StartYear int NULL;
END
ELSE PRINT '  StartYear already present';
GO

IF COL_LENGTH('dbo.StudentData', 'Degree') IS NULL
BEGIN
    PRINT '  adding Degree';
    -- Bachelor, Master or PhD; free text so another one can be added without a
    -- migration, and validated by the API rather than a constraint.
    ALTER TABLE dbo.StudentData ADD Degree varchar(30) NULL;
END
ELSE PRINT '  Degree already present';
GO

-- StudentID carries the year the student started, as in STU-2021-001, so the
-- backfill reads it from there rather than guessing. Only rows with no StartYear
-- are touched, which keeps this re-runnable and never overwrites an admin's edit.
PRINT 'Backfilling StartYear from StudentID...';
UPDATE dbo.StudentData
   SET StartYear = TRY_CAST(SUBSTRING(StudentID, 5, 4) AS int)
 WHERE StartYear IS NULL
   AND StudentID LIKE 'STU-[0-9][0-9][0-9][0-9]-%';
GO

PRINT 'Defaulting the degree where it is unset...';
UPDATE dbo.StudentData
   SET Degree = 'Bachelor'
 WHERE Degree IS NULL;
GO

-- The backup records no join date for anyone. For students the start year is a
-- reasonable stand-in - they joined when their first year began - so the field
-- is useful straight away rather than blank for everybody. Only rows with no
-- date are touched, so an admin's correction is never overwritten, and staff
-- are left null because nothing in the data hints at when they arrived.
PRINT 'Inferring a join date for students from their start year...';
UPDATE u
   SET u.JoinDate = DATEFROMPARTS(sd.StartYear, 9, 1)
  FROM dbo.UserAccount u
  JOIN dbo.StudentData sd ON sd.ID = u.ID
 WHERE u.JoinDate IS NULL
   AND sd.StartYear IS NOT NULL;
GO

PRINT '';
PRINT 'dbo.StudentData now:';
SELECT ID, StudentID, Major, AcademicYear, StartYear, Degree
FROM dbo.StudentData
ORDER BY ID;
GO
