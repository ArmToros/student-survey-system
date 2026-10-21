-- Brings dbo.NewsType in line with the four categories the app actually offers.
--
-- src/translations.js has always listed Academic, Events, Announcements and
-- Sports as the news filters, but the backup ships Announcement, Event,
-- Reminder, General and Academic. So two names were slightly wrong, "Sports"
-- did not exist at all, and two categories existed that the UI never offers.
--
-- This is a DATA script, not a schema one: no column or table changes. It is
-- re-runnable - rerunning it finds everything already in place and does nothing.
--
-- Every news item keeps its content; only which category it belongs to changes:
--   Reminder -> Academic        exam schedules and registration reminders
--   General  -> Announcements   library hours, Wi-Fi maintenance
--   "Sports Day ..." -> Sports  so the new category is not empty
--
-- The two emptied categories are then removed, which is safe because the script
-- only deletes a type once nothing references it.
:on error exit

USE SSS;
GO

PRINT 'Renaming categories to match the UI...';
UPDATE dbo.NewsType SET Name = N'Announcements' WHERE Name = N'Announcement';
UPDATE dbo.NewsType SET Name = N'Events'        WHERE Name = N'Event';
GO

PRINT 'Adding the Sports category if missing...';
IF NOT EXISTS (SELECT 1 FROM dbo.NewsType WHERE Name = N'Sports')
BEGIN
    -- ID is not an identity column, so the key is allocated here.
    INSERT INTO dbo.NewsType (ID, Name)
    SELECT ISNULL(MAX(ID), 0) + 1, N'Sports' FROM dbo.NewsType;
END
GO

PRINT 'Moving items out of the categories the UI does not offer...';
UPDATE n
   SET n.NewsTypeID = (SELECT ID FROM dbo.NewsType WHERE Name = N'Academic')
  FROM dbo.News n
  JOIN dbo.NewsType t ON t.ID = n.NewsTypeID
 WHERE t.Name = N'Reminder';

UPDATE n
   SET n.NewsTypeID = (SELECT ID FROM dbo.NewsType WHERE Name = N'Announcements')
  FROM dbo.News n
  JOIN dbo.NewsType t ON t.ID = n.NewsTypeID
 WHERE t.Name = N'General';
GO

PRINT 'Filing the sports item under Sports...';
UPDATE dbo.News
   SET NewsTypeID = (SELECT ID FROM dbo.NewsType WHERE Name = N'Sports')
 WHERE Title LIKE N'Sports Day%';
GO

PRINT 'Removing the now-unused categories...';
DELETE FROM dbo.NewsType
 WHERE Name IN (N'Reminder', N'General')
   AND NOT EXISTS (SELECT 1 FROM dbo.News n WHERE n.NewsTypeID = dbo.NewsType.ID);
GO

PRINT '';
PRINT 'News categories now:';
SELECT t.ID, t.Name, COUNT(n.ID) AS Items
  FROM dbo.NewsType t
  LEFT JOIN dbo.News n ON n.NewsTypeID = t.ID
 GROUP BY t.ID, t.Name
 ORDER BY t.Name;
GO
