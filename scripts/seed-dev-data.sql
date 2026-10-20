-- Creates the SSS database from scratch and fills it with synthetic sample data.
--
-- This is the alternative to restoring "new database/SSS.bak": it needs no backup
-- file, so it works on a machine that has only a SQL Server (a container, for
-- example) and lets the whole stack come up from the contents of this repository.
-- scripts/restore.sql and scripts/restore-localdb.ps1 remain the path to use when
-- you do have the real backup, and this script does not touch either of them.
--
-- WARNING: like the restore scripts, this REPLACES the SSS database. Anything in
-- an existing SSS - including a restore of the real backup - is dropped first.
--
-- The schema below is the schema backup set 7 produces, read off a restored copy:
-- the same tables, column names (including the misspelled Question.Answear and the
-- ID / SurveyID / QuestionID naming), types, nullability, identity columns,
-- defaults, collation and constraint names. Three foreign keys keep the
-- system-generated names the backup carries (FK__Question__Survey__778AC167,
-- FK__SurveyAns__Quest__7F2BE32F, FK__SurveyAns__Sessi__7E37BEF6) rather than the
-- tidier names SssContext passes to HasConstraintName; constraint names are not
-- used at runtime, and matching the backup is what keeps the two paths identical.
--
-- Everyone in this data is invented. Names, email addresses (all under the
-- reserved example.edu domain), phone numbers (the +1-555-01xx range reserved for
-- fiction) and addresses are placeholders, and the passwords are the same
-- "hash_admin_1" style placeholder strings the backup carries, stored in clear text
-- so "npm run db:hash-passwords" hashes them exactly as it does after a restore.
-- README.md lists the logins.
--
-- Run it with "npm run db:seed", or directly:
--     set SssScriptsDir=scripts
--     sqlcmd -S "(localdb)\MSSQLLocalDB" -b -C -i scripts\seed-dev-data.sql
--
-- SssScriptsDir says where the other scripts in this folder are, because the
-- PasswordResetToken table is created by including
-- scripts/schema-password-reset-token.sql rather than by repeating it here.
:on error exit

USE master;
GO

IF DB_ID('SSS') IS NOT NULL
BEGIN
    PRINT 'Dropping the existing SSS database...';
    ALTER DATABASE SSS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE SSS;
END
GO

PRINT 'Creating database SSS...';
-- The collation the backup restores with, and the one SssContext declares through
-- modelBuilder.UseCollation.
CREATE DATABASE SSS COLLATE Cyrillic_General_CI_AS;
GO

USE SSS;
GO

/* ===================================================================== *
 *  Schema                                                               *
 * ===================================================================== */

PRINT 'Creating tables...';
GO

CREATE TABLE dbo.UserAccount
(
    ID           int           NOT NULL
        CONSTRAINT PK__UserAcco__3214EC2741546A6A PRIMARY KEY,
    Role         varchar(20)   NULL,
    FirstName    nvarchar(50)  NULL,
    LastName     nvarchar(50)  NULL,
    MiddleName   nvarchar(50)  NULL,
    Email        varchar(100)  NULL,
    Phone        varchar(20)   NULL,
    Address      nvarchar(200) NULL,
    PasswordHash varchar(255)  NULL,
    Language     nvarchar(20)  NULL,
    Theme        nvarchar(10)  NULL
);
GO

-- StudentData and LecturerData extend UserAccount one to one: the primary key is
-- also the foreign key back to the account.
CREATE TABLE dbo.StudentData
(
    ID           int         NOT NULL
        CONSTRAINT PK__StudentD__3214EC2785CC63E1 PRIMARY KEY
        CONSTRAINT FK__StudentData__ID__440B1D61 REFERENCES dbo.UserAccount (ID),
    StudentID    varchar(20) NULL,
    Major        varchar(50) NULL,
    AcademicYear int         NULL
);
GO

CREATE TABLE dbo.LecturerData
(
    ID         int         NOT NULL
        CONSTRAINT PK__Lecturer__3214EC27173D41A4 PRIMARY KEY
        CONSTRAINT FK__LecturerData__ID__46E78A0C REFERENCES dbo.UserAccount (ID),
    Department varchar(50) NULL
);
GO

CREATE TABLE dbo.Course
(
    ID           int          NOT NULL
        CONSTRAINT PK__Course__3214EC27287D7EB7 PRIMARY KEY,
    CourseNumber varchar(10)  NOT NULL
        CONSTRAINT UQ__Course__A98290ED7336AF6E UNIQUE,
    CourseName   varchar(100) NULL
);
GO

CREATE TABLE dbo.StudentCourse
(
    StudentID int NOT NULL
        CONSTRAINT FK__StudentCo__Stude__5070F446 REFERENCES dbo.StudentData (ID),
    CourseID  int NOT NULL
        CONSTRAINT FK__StudentCo__Cours__5165187F REFERENCES dbo.Course (ID),
    CONSTRAINT PK__StudentC__5E57FD61BBA6B2EC PRIMARY KEY (StudentID, CourseID)
);
GO

CREATE TABLE dbo.NewsType
(
    ID   int          NOT NULL
        CONSTRAINT PK__NewsType__3214EC277A323D85 PRIMARY KEY,
    Name nvarchar(50) NOT NULL
);
GO

CREATE TABLE dbo.News
(
    ID         int           NOT NULL
        CONSTRAINT PK__News__3214EC275F83B3C3 PRIMARY KEY,
    Title      nvarchar(200) NOT NULL,
    Content    nvarchar(max) NOT NULL,
    NewsTypeID int           NOT NULL
        CONSTRAINT FK__News__NewsTypeID__571DF1D5 REFERENCES dbo.NewsType (ID),
    CreatedAt  datetime      NULL
        CONSTRAINT DF__News__CreatedAt__5629CD9C DEFAULT (getdate()),
    -- Nullable: a news item with no author is shown as written by "System".
    CreatedBy  int           NULL
        CONSTRAINT FK__News__CreatedBy__5812160E REFERENCES dbo.UserAccount (ID)
);
GO

-- A news item with no rows here is visible to every role.
CREATE TABLE dbo.NewsTargetRole
(
    NewsID int          NOT NULL
        CONSTRAINT FK__NewsTarge__NewsI__5AEE82B9 REFERENCES dbo.News (ID),
    Role   nvarchar(20) NOT NULL,
    CONSTRAINT PK__NewsTarg__78EFE9C0D5C6EB74 PRIMARY KEY (NewsID, Role)
);
GO

-- Chat and ChatMessage hold the support conversations. Backup set 7 renamed them
-- from Survey and SurveyMessage and left the constraint names behind, which is why
-- a table called Chat has a primary key called PK__Survey__... and default
-- constraints called DF__Survey__...
CREATE TABLE dbo.Chat
(
    ID            int           NOT NULL
        CONSTRAINT PK__Survey__3214EC27A1BC4976 PRIMARY KEY,
    Title         nvarchar(200) NOT NULL,
    CreatedBy     int           NOT NULL
        CONSTRAINT FK__Survey__CreatedB__5FB337D6 REFERENCES dbo.UserAccount (ID),
    AssignedAdmin int           NOT NULL
        CONSTRAINT FK__Survey__Assigned__60A75C0F REFERENCES dbo.UserAccount (ID),
    IsClosed      bit           NULL
        CONSTRAINT DF__Survey__IsClosed__5DCAEF64 DEFAULT ((0)),
    CreatedAt     datetime      NULL
        CONSTRAINT DF__Survey__CreatedA__5EBF139D DEFAULT (getdate()),
    ClosedAt      datetime      NULL
);
GO

CREATE TABLE dbo.ChatMessage
(
    ID          int           NOT NULL
        CONSTRAINT PK__SurveyMe__3214EC279040335B PRIMARY KEY,
    ChatID      int           NOT NULL
        CONSTRAINT FK__SurveyMes__Surve__6477ECF3 REFERENCES dbo.Chat (ID),
    SentBy      int           NOT NULL
        CONSTRAINT FK__SurveyMes__SentB__656C112C REFERENCES dbo.UserAccount (ID),
    MessageText nvarchar(max) NOT NULL,
    SentAt      datetime      NULL
        CONSTRAINT DF__SurveyMes__SentA__6383C8BA DEFAULT (getdate()),
    -- Set on a message from whoever opened the conversation.
    IsQuestion  bit           NOT NULL
);
GO

-- The real survey engine. Survey carries no status and no dates, so the API reports
-- every survey as active; that gap is reproduced here rather than papered over.
CREATE TABLE dbo.Survey
(
    SurveyID  int           NOT NULL
        CONSTRAINT PK_Survey PRIMARY KEY,
    CreatedBy int           NOT NULL
        CONSTRAINT FK_Survey_UserAccount REFERENCES dbo.UserAccount (ID)
            ON UPDATE CASCADE ON DELETE CASCADE,
    Topic     nvarchar(100) NULL
);
GO

-- Question has no column for the question text, no type and no option list.
-- "Answear" (the backup's spelling) is its only text column, so the API uses it as
-- the question label and derives the options from the answers already recorded.
CREATE TABLE dbo.Question
(
    QuestionID int           NOT NULL
        CONSTRAINT PK_Question PRIMARY KEY,
    Answear    nvarchar(500) NULL,
    SurveyID   int           NULL
        CONSTRAINT FK__Question__Survey__778AC167 REFERENCES dbo.Survey (SurveyID)
);
GO

-- SurveySession.ID was added after the other two columns, so in the backup it is
-- the third column of the table rather than the first.
CREATE TABLE dbo.SurveySession
(
    SurveyID int NOT NULL
        CONSTRAINT FK_SurveySession_Survey REFERENCES dbo.Survey (SurveyID),
    UserID   int NOT NULL
        CONSTRAINT FK_SurveySession_UserAccount REFERENCES dbo.UserAccount (ID)
            ON UPDATE CASCADE ON DELETE CASCADE,
    ID       int IDENTITY(1,1) NOT NULL
        CONSTRAINT PK__SurveySe__3214EC27836E06C7 PRIMARY KEY
);
GO

CREATE TABLE dbo.SurveyAnswer
(
    ID         int IDENTITY(1,1) NOT NULL
        CONSTRAINT PK__SurveyAn__3214EC2724CF67F6 PRIMARY KEY,
    SessionID  int           NOT NULL
        CONSTRAINT FK__SurveyAns__Sessi__7E37BEF6 REFERENCES dbo.SurveySession (ID),
    QuestionID int           NOT NULL
        CONSTRAINT FK__SurveyAns__Quest__7F2BE32F REFERENCES dbo.Question (QuestionID),
    Answer     nvarchar(max) NULL
);
GO

-- PasswordResetToken is not in the backup; both restore paths create it with this
-- script afterwards, so the seeded database gets it from the same place.
PRINT 'Including schema-password-reset-token.sql...';
GO
:r $(SssScriptsDir)/schema-password-reset-token.sql

-- The survey authoring columns are likewise added after a restore rather than
-- coming from the backup, so the seeded database takes them from the same script.
PRINT 'Including schema-authoring.sql...';
GO
:r $(SssScriptsDir)/schema-authoring.sql

PRINT 'Including schema-support-chat.sql...';
GO
:r $(SssScriptsDir)/schema-support-chat.sql

PRINT 'Including schema-student-profile.sql...';
GO
:r $(SssScriptsDir)/schema-student-profile.sql

USE SSS;
GO

/* ===================================================================== *
 *  Sample data                                                          *
 * ===================================================================== */

SET NOCOUNT ON;
GO

PRINT '';
PRINT 'Inserting accounts...';
GO

-- Roles are stored capitalised ("Admin", "Lecturer", "Student") because that is
-- what the backup holds and what the API and the JWT policies compare against.
-- The IDs follow the backup's layout: admins first, then lecturers, then students.
INSERT INTO dbo.UserAccount (ID, Role, FirstName, LastName, MiddleName, Email, Phone, Address, PasswordHash, Language, Theme) VALUES
    ( 1, 'Admin',    N'Anahit', N'Demoyan',      N'Sargsi', 'admin.one@seed.example.edu',             '+1-555-0101', N'1 Example Way, Demo City',       'hash_admin_1', N'Armenian', N'Dark'),
    ( 2, 'Admin',    N'Marcus', N'Fixtureson',   NULL,      'admin.two@seed.example.edu',             '+1-555-0102', N'2 Example Way, Demo City',       'hash_admin_2', N'English',  N'Light'),
    ( 3, 'Lecturer', N'Petros', N'Mockoyan',     N'Aram',   'lecturer.one@seed.example.edu',          '+1-555-0103', N'3 Sample Street, Demo City',     'hash_lect_1',  N'Armenian', N'Light'),
    ( 4, 'Lecturer', N'Lusine', N'Stuboyan',     NULL,      'lecturer.two@seed.example.edu',          '+1-555-0104', N'4 Sample Street, Demo City',     'hash_lect_2',  N'English',  N'Light'),
    ( 5, 'Lecturer', N'Edgar',  N'Sampleson',    N'Vahe',   'lecturer.three@seed.example.edu',        '+1-555-0105', N'5 Sample Street, Demo City',     'hash_lect_3',  N'Armenian', N'Dark'),
    ( 6, 'Lecturer', N'Narine', N'Placeholdian', NULL,      'lecturer.four@seed.example.edu',         '+1-555-0106', N'6 Sample Street, Demo City',     'hash_lect_4',  N'English',  N'Dark'),
    ( 7, 'Student',  N'Davit',  N'Testoyan',     N'Aren',   'student.one@student.seed.example.edu',   '+1-555-0107', N'7 Placeholder Lane, Demo City',  'hash_stud_1',  N'Armenian', N'Light'),
    ( 8, 'Student',  N'Mariam', N'Dummyan',      NULL,      'student.two@student.seed.example.edu',   '+1-555-0108', N'8 Placeholder Lane, Demo City',  'hash_stud_2',  N'Armenian', N'Dark'),
    ( 9, 'Student',  N'Tigran', N'Seedarian',    NULL,      'student.three@student.seed.example.edu', '+1-555-0109', N'9 Placeholder Lane, Demo City',  'hash_stud_3',  N'English',  N'Light'),
    (10, 'Student',  N'Ani',    N'Mockova',      N'Lia',    'student.four@student.seed.example.edu',  '+1-555-0110', N'10 Placeholder Lane, Demo City', 'hash_stud_4',  N'English',  N'Dark'),
    (11, 'Student',  N'Hayk',   N'Fixturyan',    NULL,      'student.five@student.seed.example.edu',  '+1-555-0111', N'11 Placeholder Lane, Demo City', 'hash_stud_5',  N'Armenian', N'Light'),
    (12, 'Student',  N'Sona',   N'Stubova',      NULL,      'student.six@student.seed.example.edu',   '+1-555-0112', N'12 Placeholder Lane, Demo City', 'hash_stud_6',  N'Armenian', N'Dark'),
    (13, 'Student',  N'Grigor', N'Exampleyan',   N'Suren',  'student.seven@student.seed.example.edu', '+1-555-0113', N'13 Placeholder Lane, Demo City', 'hash_stud_7',  N'English',  N'Light'),
    (14, 'Student',  N'Nare',   N'Sampleova',    NULL,      'student.eight@student.seed.example.edu', '+1-555-0114', N'14 Placeholder Lane, Demo City', 'hash_stud_8',  N'Armenian', N'Light'),
    (15, 'Student',  N'Vahan',  N'Demoyan',      NULL,      'student.nine@student.seed.example.edu',  '+1-555-0115', N'15 Placeholder Lane, Demo City', 'hash_stud_9',  N'English',  N'Dark'),
    (16, 'Student',  N'Lilit',  N'Testova',      N'Mane',   'student.ten@student.seed.example.edu',   '+1-555-0116', N'16 Placeholder Lane, Demo City', 'hash_stud_10', N'Armenian', N'Light'),
    (17, 'Student',  N'Armen',  N'Dummyson',     NULL,      'student.eleven@student.seed.example.edu','+1-555-0117', N'17 Placeholder Lane, Demo City', 'hash_stud_11', N'English',  N'Light'),
    (18, 'Student',  N'Elen',   N'Placeholdova', NULL,      'student.twelve@student.seed.example.edu','+1-555-0118', N'18 Placeholder Lane, Demo City', 'hash_stud_12', N'Armenian', N'Dark');
GO

INSERT INTO dbo.LecturerData (ID, Department) VALUES
    (3, 'Computer Science'),
    (4, 'Mathematics'),
    (5, 'Cybersecurity'),
    (6, 'Data Science');
GO

INSERT INTO dbo.StudentData (ID, StudentID, Major, AcademicYear) VALUES
    ( 7, 'S2026001', 'Computer Science',     2),
    ( 8, 'S2026002', 'Computer Science',     3),
    ( 9, 'S2026003', 'Software Engineering', 1),
    (10, 'S2026004', 'Information Systems',  2),
    (11, 'S2026005', 'Cybersecurity',        1),
    (12, 'S2026006', 'Cybersecurity',        2),
    (13, 'S2026007', 'Data Science',         1),
    (14, 'S2026008', 'Data Science',         3),
    (15, 'S2026009', 'Mathematics',          2),
    (16, 'S2026010', 'Information Systems',  3),
    (17, 'S2026011', 'Computer Science',     4),
    (18, 'S2026012', 'Software Engineering', 2);
GO

PRINT 'Inserting courses and enrolments...';
GO

INSERT INTO dbo.Course (ID, CourseNumber, CourseName) VALUES
    ( 1, 'CS101',   'Introduction to Programming'),
    ( 2, 'CS102',   'Object Oriented Programming'),
    ( 3, 'CS202',   'Data Structures and Algorithms'),
    ( 4, 'CS205',   'Computer Networks'),
    ( 5, 'CS303',   'Operating Systems'),
    ( 6, 'CS404',   'Database Systems'),
    ( 7, 'MATH101', 'Discrete Mathematics'),
    ( 8, 'MATH202', 'Linear Algebra'),
    ( 9, 'SEC301',  'Cybersecurity Fundamentals'),
    (10, 'DS201',   'Introduction to Data Science');
GO

-- Three courses per student.
INSERT INTO dbo.StudentCourse (StudentID, CourseID) VALUES
    ( 7, 1), ( 7, 3), ( 7, 7),
    ( 8, 3), ( 8, 5), ( 8, 6),
    ( 9, 1), ( 9, 2), ( 9, 7),
    (10, 2), (10, 4), (10, 6),
    (11, 1), (11, 4), (11, 9),
    (12, 5), (12, 6), (12, 9),
    (13, 1), (13, 8), (13, 10),
    (14, 3), (14, 6), (14, 10),
    (15, 2), (15, 7), (15, 8),
    (16, 2), (16, 4), (16, 6),
    (17, 3), (17, 5), (17, 6),
    (18, 1), (18, 2), (18, 10);
GO

PRINT 'Inserting news...';
GO

INSERT INTO dbo.NewsType (ID, Name) VALUES
    (1, N'Announcement'),
    (2, N'Event'),
    (3, N'Reminder'),
    (4, N'General'),
    (5, N'Academic');
GO

-- Dates are relative to now, so the list always looks current. News 5 and 10 have
-- no author, which is what exercises the "System" author fallback.
INSERT INTO dbo.News (ID, Title, Content, NewsTypeID, CreatedAt, CreatedBy) VALUES
    ( 1, N'Autumn term registration is open',
         N'Registration for autumn term courses is open until the end of the month. Sign in to the portal, open My Courses and confirm your choices. Students who miss the deadline are enrolled in their department default set.',
         1, DATEADD(day, -20, GETDATE()), 1),
    ( 2, N'Open day for prospective students',
         N'The university holds its autumn open day next weekend. Departments will run lab tours and short taster lectures, and current students are welcome to help on the stands. Volunteers can sign up with the student office.',
         2, DATEADD(day, -18, GETDATE()), 2),
    ( 3, N'Library books due before the break',
         N'All borrowed books must be returned before the end of term. Loans are not renewed automatically over the break, and unreturned items are charged at the usual daily rate.',
         3, DATEADD(day, -16, GETDATE()), 1),
    ( 4, N'CS101 syllabus updated',
         N'The CS101 syllabus has been updated: recursion now comes before sorting, and the midterm covers everything up to and including lists. The new version is on the course page.',
         5, DATEADD(day, -14, GETDATE()), 3),
    ( 5, N'Campus wifi maintenance window',
         N'Campus wifi will be unavailable on Sunday between 02:00 and 06:00 while the access points are upgraded. Wired connections in the labs are not affected.',
         4, DATEADD(day, -12, GETDATE()), NULL),
    ( 6, N'New teaching lab opens in the science building',
         N'The new teaching lab on the second floor of the science building is open. It holds thirty workstations, is bookable by lecturers for scheduled sessions and is open to students at all other times.',
         1, DATEADD(day, -10, GETDATE()), 2),
    ( 7, N'Guest lecture: careers in data science',
         N'A guest lecture on careers in data science takes place on Thursday afternoon in the main hall. No booking is needed and the session will not be recorded.',
         2, DATEADD(day,  -9, GETDATE()), 6),
    ( 8, N'The lab equipment survey closes on Friday',
         N'The survey on teaching lab equipment closes at the end of the week. It takes about two minutes and the results feed straight into next year''s equipment budget.',
         3, DATEADD(day,  -7, GETDATE()), 1),
    ( 9, N'MATH101 exam timetable published',
         N'The MATH101 exam timetable is published. Check your room allocation carefully: the cohort is split across two rooms this term.',
         5, DATEADD(day,  -6, GETDATE()), 4),
    (10, N'Student support hours extended',
         N'The student support desk is now open until 18:00 on weekdays. No appointment is needed, and the desk can help with enrolment, timetables and transcript requests.',
         4, DATEADD(day,  -4, GETDATE()), NULL),
    (11, N'Cybersecurity awareness week',
         N'Next week is cybersecurity awareness week. There are drop-in sessions on passwords, phishing and device encryption every lunchtime, and the mandatory security training is open to everyone in the portal.',
         1, DATEADD(day,  -2, GETDATE()), 5),
    (12, N'End of term social',
         N'The end of term social is on the last Friday of term in the student union. Everyone is welcome and food is provided.',
         2, DATEADD(day,  -1, GETDATE()), 1);
GO

-- News 5 and 10 are deliberately left without target roles, which is what makes
-- them visible to every role.
INSERT INTO dbo.NewsTargetRole (NewsID, Role) VALUES
    ( 1, N'Student'), ( 1, N'Lecturer'), ( 1, N'Admin'),
    ( 2, N'Student'), ( 2, N'Lecturer'), ( 2, N'Admin'),
    ( 3, N'Student'),
    ( 4, N'Student'), ( 4, N'Lecturer'), ( 4, N'Admin'),
    ( 6, N'Student'), ( 6, N'Lecturer'), ( 6, N'Admin'),
    ( 7, N'Student'), ( 7, N'Lecturer'),
    ( 8, N'Student'),
    ( 9, N'Student'),
    (11, N'Student'), (11, N'Lecturer'), (11, N'Admin'),
    (12, N'Student'), (12, N'Lecturer');
GO

PRINT 'Inserting support conversations...';
GO

INSERT INTO dbo.Chat (ID, Title, CreatedBy, AssignedAdmin, IsClosed, CreatedAt, ClosedAt) VALUES
    ( 1, N'Cannot open my timetable',           7, 1, 0, DATEADD(day, -14, GETDATE()), NULL),
    ( 2, N'Grade query for CS202',              8, 2, 0, DATEADD(day, -13, GETDATE()), NULL),
    ( 3, N'Library card not recognised',        9, 1, 1, DATEADD(day, -12, GETDATE()), DATEADD(day, -11, GETDATE())),
    ( 4, N'Enrolment blocked for CS404',       10, 2, 1, DATEADD(day, -11, GETDATE()), DATEADD(day, -10, GETDATE())),
    ( 5, N'Password reset mail never arrived', 11, 1, 0, DATEADD(day,  -9, GETDATE()), NULL),
    ( 6, N'Request to change major',           12, 2, 0, DATEADD(day,  -8, GETDATE()), NULL),
    ( 7, N'Lab access card expired',           13, 1, 1, DATEADD(day,  -7, GETDATE()), DATEADD(day,  -6, GETDATE())),
    ( 8, N'Question about the resit policy',   14, 2, 0, DATEADD(day,  -6, GETDATE()), NULL),
    ( 9, N'Wrong course on my record',         15, 1, 0, DATEADD(day,  -5, GETDATE()), NULL),
    (10, N'Transcript request',                16, 2, 1, DATEADD(day,  -4, GETDATE()), DATEADD(day,  -3, GETDATE())),
    (11, N'Printing quota used up',            17, 1, 0, DATEADD(day,  -2, GETDATE()), NULL),
    (12, N'Survey link does not load',         18, 2, 0, DATEADD(day,  -1, GETDATE()), NULL);
GO

-- IsQuestion marks a message from whoever opened the conversation.
INSERT INTO dbo.ChatMessage (ID, ChatID, SentBy, MessageText, SentAt, IsQuestion) VALUES
    ( 1,  1,  7, N'Hello, the timetable page just spins when I open it.',                           DATEADD(day, -14, GETDATE()), 1),
    ( 2,  1,  1, N'Thanks for reporting it. Could you try again now and tell me what you see?',     DATEADD(day, -13, GETDATE()), 0),
    ( 3,  1,  7, N'It loads now, thank you.',                                                       DATEADD(day, -13, GETDATE()), 1),
    ( 4,  2,  8, N'I think my CS202 midterm grade was recorded against the wrong assignment.',      DATEADD(day, -13, GETDATE()), 1),
    ( 5,  2,  2, N'I have asked the course lecturer to check the marks sheet.',                     DATEADD(day, -12, GETDATE()), 0),
    ( 6,  2,  8, N'Understood, I will wait to hear back.',                                           DATEADD(day, -12, GETDATE()), 1),
    ( 7,  3,  9, N'My library card is not recognised at the gate.',                                 DATEADD(day, -12, GETDATE()), 1),
    ( 8,  3,  1, N'Your card had expired. A new one is ready to collect from the front desk.',      DATEADD(day, -11, GETDATE()), 0),
    ( 9,  3,  9, N'Collected, and it works. Closing this one.',                                     DATEADD(day, -11, GETDATE()), 1),
    (10,  4, 10, N'The portal will not let me enrol in CS404.',                                     DATEADD(day, -11, GETDATE()), 1),
    (11,  4,  2, N'CS404 needs CS202 first. I have added the prerequisite waiver to your record.',  DATEADD(day, -10, GETDATE()), 0),
    (12,  4, 10, N'Enrolled now, thanks for the quick fix.',                                        DATEADD(day, -10, GETDATE()), 1),
    (13,  5, 11, N'I asked for a password reset twice and no mail arrived.',                        DATEADD(day,  -9, GETDATE()), 1),
    (14,  5,  1, N'Our mail log shows both messages were sent. Please check your spam folder.',     DATEADD(day,  -8, GETDATE()), 0),
    (15,  6, 12, N'How do I apply to move from Cybersecurity to Data Science?',                     DATEADD(day,  -8, GETDATE()), 1),
    (16,  6,  2, N'You need a transfer form signed by both departments. The steps are attached.',   DATEADD(day,  -7, GETDATE()), 0),
    (17,  7, 13, N'My lab access card stopped working this morning.',                               DATEADD(day,  -7, GETDATE()), 1),
    (18,  7,  1, N'Reissued. It should work from the next door you try.',                           DATEADD(day,  -6, GETDATE()), 0),
    (19,  8, 14, N'If I miss an exam for medical reasons, does the resit count as a first sit?',    DATEADD(day,  -6, GETDATE()), 1),
    (20,  8,  2, N'Yes, with an approved medical certificate it is treated as a first attempt.',    DATEADD(day,  -5, GETDATE()), 0),
    (21,  9, 15, N'My record lists MATH202 but I never enrolled in it.',                            DATEADD(day,  -5, GETDATE()), 1),
    (22,  9,  1, N'I can see the duplicate enrolment and have asked the registry to remove it.',    DATEADD(day,  -4, GETDATE()), 0),
    (23, 10, 16, N'Could I get an official transcript for a placement application?',                DATEADD(day,  -4, GETDATE()), 1),
    (24, 10,  2, N'Sent to your university address this morning.',                                  DATEADD(day,  -3, GETDATE()), 0),
    (25, 11, 17, N'I have used up my printing quota two weeks before the end of term.',             DATEADD(day,  -2, GETDATE()), 1),
    (26, 12, 18, N'The link in the survey reminder email gives me a blank page.',                   DATEADD(day,  -1, GETDATE()), 1);
GO

PRINT 'Inserting surveys, questions and responses...';
GO

INSERT INTO dbo.Survey (SurveyID, CreatedBy, Topic) VALUES
    (1, 3, N'CS101 Midterm Feedback'),
    (2, 4, N'MATH101 Course Quality'),
    (3, 1, N'Campus Facilities Satisfaction'),
    (4, 5, N'Cybersecurity Awareness'),
    (5, 6, N'Data Science Elective Interest'),
    (6, 3, N'Lab Equipment Satisfaction');
GO

-- Answear is the only text column on Question, so the API shows it as the question
-- label. The real backup happens to hold answer fragments there ("A", "B"), which
-- reads badly in the UI; the seeded rows hold the question itself instead.
-- KNOWN_GAPS.md records the difference.
INSERT INTO dbo.Question (QuestionID, SurveyID, Answear) VALUES
    ( 1, 1, N'The midterm covered the material taught in the lectures.'),
    ( 2, 1, N'How satisfied were you with the time allowed for the midterm?'),
    ( 3, 1, N'The practice problems prepared me well for the exam.'),
    ( 4, 2, N'The course materials were clear and well organised.'),
    ( 5, 2, N'How satisfied are you with the pace of the lectures?'),
    ( 6, 3, N'How satisfied are you with the study spaces on campus?'),
    ( 7, 3, N'How satisfied are you with the campus catering?'),
    ( 8, 3, N'The opening hours of the library meet my needs.'),
    ( 9, 4, N'Have you completed the mandatory security training this year?'),
    (10, 4, N'Would you report a suspicious email to the IT helpdesk?'),
    (11, 5, N'Would you take a data science elective next term?'),
    (12, 5, N'How satisfied are you with the current choice of electives?'),
    (13, 6, N'How satisfied are you with the equipment in the teaching labs?'),
    (14, 6, N'Is there enough lab equipment for everyone in your group?');
GO

-- One session is one student's run through one survey. ID is an identity column, so
-- these rows take IDs 1 to 18 in the order listed.
INSERT INTO dbo.SurveySession (SurveyID, UserID) VALUES
    (1,  7), (1,  8), (1,  9), (1, 10), (1, 11),
    (2, 12), (2, 13), (2, 15),
    (3,  7), (3,  9), (3, 14),
    (4,  8), (4, 10), (4, 16),
    (5, 11), (5, 17),
    (6, 13), (6, 18);
GO

-- The API derives a question's answer options from the values already recorded
-- against it: two or more distinct answers make it a single-choice question, and a
-- question with fewer falls back to a free text box. So every question gets an
-- answer from every session of its survey, taken from whichever Likert scale suits
-- it, which leaves each question with at least two distinct options and gives the
-- results page something to chart.
DECLARE @QuestionScale TABLE (QuestionID int PRIMARY KEY, Scale varchar(20));

INSERT INTO @QuestionScale (QuestionID, Scale) VALUES
    ( 1, 'agree'),        ( 2, 'satisfaction'), ( 3, 'agree'),
    ( 4, 'agree'),        ( 5, 'satisfaction'),
    ( 6, 'satisfaction'), ( 7, 'satisfaction'), ( 8, 'agree'),
    ( 9, 'yesno'),        (10, 'yesno'),
    (11, 'yesno'),        (12, 'satisfaction'),
    (13, 'satisfaction'), (14, 'yesno');

INSERT INTO dbo.SurveyAnswer (SessionID, QuestionID, Answer)
SELECT  taken.ID,
        asked.QuestionID,
        CASE scale.Scale
            WHEN 'agree' THEN CHOOSE(((taken.ID + asked.QuestionID) % 5) + 1,
                N'Strongly Agree', N'Agree', N'Neutral', N'Disagree', N'Strongly Disagree')
            WHEN 'satisfaction' THEN CHOOSE(((taken.ID + asked.QuestionID) % 4) + 1,
                N'Very Satisfied', N'Satisfied', N'Neutral', N'Dissatisfied')
            WHEN 'yesno' THEN CHOOSE(((taken.ID + asked.QuestionID) % 2) + 1,
                N'Yes', N'No')
        END
FROM dbo.SurveySession AS taken
JOIN dbo.Question      AS asked ON asked.SurveyID = taken.SurveyID
JOIN @QuestionScale    AS scale ON scale.QuestionID = asked.QuestionID
ORDER BY taken.ID, asked.QuestionID;
GO

/* ===================================================================== *
 *  Summary                                                              *
 * ===================================================================== */

PRINT '';
PRINT 'Seeded row counts:';

SELECT 'UserAccount' AS TableName, COUNT_BIG(*) AS [Rows] FROM dbo.UserAccount
UNION ALL SELECT 'StudentData',        COUNT_BIG(*) FROM dbo.StudentData
UNION ALL SELECT 'LecturerData',       COUNT_BIG(*) FROM dbo.LecturerData
UNION ALL SELECT 'Course',             COUNT_BIG(*) FROM dbo.Course
UNION ALL SELECT 'StudentCourse',      COUNT_BIG(*) FROM dbo.StudentCourse
UNION ALL SELECT 'News',               COUNT_BIG(*) FROM dbo.News
UNION ALL SELECT 'NewsType',           COUNT_BIG(*) FROM dbo.NewsType
UNION ALL SELECT 'NewsTargetRole',     COUNT_BIG(*) FROM dbo.NewsTargetRole
UNION ALL SELECT 'Chat',               COUNT_BIG(*) FROM dbo.Chat
UNION ALL SELECT 'ChatMessage',        COUNT_BIG(*) FROM dbo.ChatMessage
UNION ALL SELECT 'Survey',             COUNT_BIG(*) FROM dbo.Survey
UNION ALL SELECT 'Question',           COUNT_BIG(*) FROM dbo.Question
UNION ALL SELECT 'SurveySession',      COUNT_BIG(*) FROM dbo.SurveySession
UNION ALL SELECT 'SurveyAnswer',       COUNT_BIG(*) FROM dbo.SurveyAnswer
UNION ALL SELECT 'PasswordResetToken', COUNT_BIG(*) FROM dbo.PasswordResetToken
ORDER BY TableName;
GO

-- A question with fewer than two distinct answers renders as a free text box rather
-- than a choice question, which would make the seeded surveys look broken.
DECLARE @Thin int = (
    SELECT COUNT(*)
    FROM dbo.Question q
    WHERE (SELECT COUNT(DISTINCT CONVERT(nvarchar(450), a.Answer))
           FROM dbo.SurveyAnswer a
           WHERE a.QuestionID = q.QuestionID) < 2
);

IF @Thin > 0
BEGIN
    DECLARE @ThinMessage nvarchar(400) =
        CONCAT(N'Seed produced ', @Thin, N' question(s) with fewer than two distinct answers; ',
               N'those would show as a free text box instead of answer options.');
    THROW 51002, @ThinMessage, 1;
END

PRINT '';
PRINT 'Database SSS seeded with synthetic sample data.';
GO
