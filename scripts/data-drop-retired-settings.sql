/*
    Removes two settings that no longer exist in the app.

    "Notify me by SMS" promised something nothing could deliver - there is no
    SMS gateway here and never was - and "Show my phone number" changed nothing,
    because no endpoint ever consulted it: the phone number was returned either
    way, so the toggle was a promise the API did not keep.

    Both are gone from Settings, and this clears what people had already saved.
    The rows come back with the keys after a restore, since they are in the
    backup, which is why this runs as part of the restore chain.

    JSON_MODIFY with NULL deletes the member in lax mode, so this is additive
    and re-runnable: a second run finds nothing left to change.
*/

UPDATE dbo.UserAccount
SET Preferences = JSON_MODIFY(Preferences, '$.notifications.sms', NULL)
WHERE Preferences IS NOT NULL
  AND ISJSON(Preferences) = 1
  AND JSON_VALUE(Preferences, '$.notifications.sms') IS NOT NULL;
GO

UPDATE dbo.UserAccount
SET Preferences = JSON_MODIFY(Preferences, '$.privacy.showPhone', NULL)
WHERE Preferences IS NOT NULL
  AND ISJSON(Preferences) = 1
  AND JSON_VALUE(Preferences, '$.privacy.showPhone') IS NOT NULL;
GO

PRINT 'Retired settings cleared from saved preferences.';
GO
