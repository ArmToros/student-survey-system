/*
    Survey.Deadline - the moment a survey stops accepting answers.

    Until now a survey was open until somebody closed it by hand. A deadline
    lets it close on its own, which is what "once the deadline passes" in the
    testing notes asks for.

    The column is nullable and no backfill is attempted: the surveys restored
    from the backup never had a deadline, and inventing one would close them.
    Null means "open until an admin closes it", exactly as before.

    Additive and re-runnable, like the other schema scripts here.
*/

IF COL_LENGTH('dbo.Survey', 'Deadline') IS NULL
BEGIN
    ALTER TABLE dbo.Survey ADD Deadline datetime NULL;
    PRINT 'Survey.Deadline added.';
END
ELSE
BEGIN
    PRINT 'Survey.Deadline already present.';
END
GO

/*
    Anything already past its deadline is closed, so a restore does not reopen
    a survey that had finished. Harmless on a database with no deadlines set.
*/
UPDATE dbo.Survey
SET IsClosed = 1,
    ClosedAt = COALESCE(ClosedAt, Deadline)
WHERE Deadline IS NOT NULL
  AND Deadline < GETUTCDATE()
  AND IsClosed = 0;
GO
