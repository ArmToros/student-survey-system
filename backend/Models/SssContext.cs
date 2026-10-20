using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace backend.Models;

/// <summary>
/// Maps the SSS database as restored from "new database/SSS.bak" (backup set 7).
///
/// That backup renamed the old Survey/SurveyMessage tables to Chat/ChatMessage,
/// dropped Timetable, and added a real survey engine: Survey -> Question, with
/// responses in SurveySession -> SurveyAnswer. The model below follows the
/// database as it actually is; the database itself is left untouched.
/// </summary>
public partial class SssContext : DbContext
{
    public SssContext()
    {
    }

    public SssContext(DbContextOptions<SssContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Chat> Chats { get; set; }

    public virtual DbSet<ChatMessage> ChatMessages { get; set; }

    public virtual DbSet<Course> Courses { get; set; }

    public virtual DbSet<LecturerDatum> LecturerData { get; set; }

    public virtual DbSet<News> News { get; set; }

    public virtual DbSet<NewsTargetRole> NewsTargetRoles { get; set; }

    public virtual DbSet<NewsType> NewsTypes { get; set; }

    public virtual DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

    public virtual DbSet<AppSetting> AppSettings { get; set; }

    public virtual DbSet<PresetQuestion> PresetQuestions { get; set; }

    public virtual DbSet<Question> Questions { get; set; }

    public virtual DbSet<StudentDatum> StudentData { get; set; }

    public virtual DbSet<Survey> Surveys { get; set; }

    public virtual DbSet<SurveyAnswer> SurveyAnswers { get; set; }

    public virtual DbSet<SurveySession> SurveySessions { get; set; }

    public virtual DbSet<UserAccount> UserAccounts { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? @"Server=(localdb)\MSSQLLocalDB;Database=SSS;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True";

            optionsBuilder.UseSqlServer(connectionString);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.UseCollation("Cyrillic_General_CI_AS");

        modelBuilder.Entity<Chat>(entity =>
        {
            // The key and constraint names still say "Survey" because the table was renamed.
            entity.HasKey(e => e.Id).HasName("PK__Survey__3214EC27A1BC4976");

            entity.ToTable("Chat");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.ClosedAt).HasColumnType("datetime");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.IsClosed).HasDefaultValue(false);
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.AssignedAdminNavigation).WithMany(p => p.ChatAssignedAdminNavigations)
                .HasForeignKey(d => d.AssignedAdmin)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Survey__Assigned__60A75C0F");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.ChatCreatedByNavigations)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Survey__CreatedB__5FB337D6");
        });

        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SurveyMe__3214EC279040335B");

            entity.ToTable("ChatMessage");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.ChatId).HasColumnName("ChatID");
            entity.Property(e => e.SentAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Chat).WithMany(p => p.ChatMessages)
                .HasForeignKey(d => d.ChatId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__SurveyMes__Surve__6477ECF3");

            entity.HasOne(d => d.SentByNavigation).WithMany(p => p.ChatMessages)
                .HasForeignKey(d => d.SentBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__SurveyMes__SentB__656C112C");
        });

        modelBuilder.Entity<Course>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Course__3214EC27287D7EB7");

            entity.ToTable("Course");

            entity.HasIndex(e => e.CourseNumber, "UQ__Course__A98290ED7336AF6E").IsUnique();

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.CourseName)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.LecturerId).HasColumnName("LecturerID");
            entity.Property(e => e.Schedule).HasMaxLength(200);
            entity.Property(e => e.Room).HasMaxLength(200);
            entity.Property(e => e.Focus).HasMaxLength(600);
            entity.Property(e => e.CourseNumber)
                .HasMaxLength(10)
                .IsUnicode(false);
        });

        modelBuilder.Entity<LecturerDatum>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Lecturer__3214EC27173D41A4");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.Department)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(d => d.IdNavigation).WithOne(p => p.LecturerDatum)
                .HasForeignKey<LecturerDatum>(d => d.Id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__LecturerData__ID__46E78A0C");
        });

        modelBuilder.Entity<News>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__News__3214EC275F83B3C3");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.NewsTypeId).HasColumnName("NewsTypeID");
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.News)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("FK__News__CreatedBy__5812160E");

            entity.HasOne(d => d.NewsType).WithMany(p => p.News)
                .HasForeignKey(d => d.NewsTypeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__News__NewsTypeID__571DF1D5");
        });

        modelBuilder.Entity<NewsTargetRole>(entity =>
        {
            entity.HasKey(e => new { e.NewsId, e.Role }).HasName("PK__NewsTarg__78EFE9C0D5C6EB74");

            entity.ToTable("NewsTargetRole");

            entity.Property(e => e.NewsId).HasColumnName("NewsID");
            entity.Property(e => e.Role).HasMaxLength(20);

            entity.HasOne(d => d.News).WithMany(p => p.NewsTargetRoles)
                .HasForeignKey(d => d.NewsId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__NewsTarge__NewsI__5AEE82B9");
        });

        modelBuilder.Entity<NewsType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__NewsType__3214EC277A323D85");

            entity.ToTable("NewsType");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.Name).HasMaxLength(50);
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            // Added by scripts/schema-password-reset-token.sql, not by the backup.
            entity.HasKey(e => e.Id).HasName("PK_PasswordResetToken");

            entity.ToTable("PasswordResetToken");

            entity.HasIndex(e => e.TokenHash, "UQ_PasswordResetToken_TokenHash").IsUnique();
            entity.HasIndex(e => e.UserId, "IX_PasswordResetToken_UserID");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.UserId).HasColumnName("UserID");
            entity.Property(e => e.TokenHash)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.ExpiresAt).HasColumnType("datetime");
            entity.Property(e => e.UsedAt).HasColumnType("datetime");

            entity.HasOne(d => d.User).WithMany(p => p.PasswordResetTokens)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PasswordResetToken_UserAccount");
        });

        modelBuilder.Entity<AppSetting>(entity =>
        {
            entity.HasKey(e => e.SettingKey).HasName("PK_AppSetting");

            entity.ToTable("AppSetting");

            entity.Property(e => e.SettingKey).HasMaxLength(100);
            entity.Property(e => e.Value).HasMaxLength(400);
        });

        modelBuilder.Entity<PresetQuestion>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_PresetQuestion");

            entity.ToTable("PresetQuestion");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.Question).HasMaxLength(400);
            entity.Property(e => e.CreatedBy).HasColumnName("CreatedBy");
        });

        modelBuilder.Entity<Question>(entity =>
        {
            entity.HasKey(e => e.QuestionId).HasName("PK_Question");

            entity.ToTable("Question");

            // QuestionID is not an identity column, so new keys are allocated in code.
            entity.Property(e => e.QuestionId)
                .ValueGeneratedNever()
                .HasColumnName("QuestionID");
            entity.Property(e => e.Answear).HasMaxLength(500);
            entity.Property(e => e.QuestionText).HasMaxLength(1000);
            entity.Property(e => e.QuestionType)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.SurveyId).HasColumnName("SurveyID");

            entity.HasOne(d => d.Survey).WithMany(p => p.Questions)
                .HasForeignKey(d => d.SurveyId)
                .HasConstraintName("FK_Question_Survey");
        });

        modelBuilder.Entity<StudentDatum>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__StudentD__3214EC2785CC63E1");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.Major)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.StudentId)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("StudentID");

            entity.HasOne(d => d.IdNavigation).WithOne(p => p.StudentDatum)
                .HasForeignKey<StudentDatum>(d => d.Id)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__StudentData__ID__440B1D61");

            entity.HasMany(d => d.Courses).WithMany(p => p.Students)
                .UsingEntity<Dictionary<string, object>>(
                    "StudentCourse",
                    r => r.HasOne<Course>().WithMany()
                        .HasForeignKey("CourseId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__StudentCo__Cours__5165187F"),
                    l => l.HasOne<StudentDatum>().WithMany()
                        .HasForeignKey("StudentId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__StudentCo__Stude__5070F446"),
                    j =>
                    {
                        j.HasKey("StudentId", "CourseId").HasName("PK__StudentC__5E57FD61BBA6B2EC");
                        j.ToTable("StudentCourse");
                        j.IndexerProperty<int>("StudentId").HasColumnName("StudentID");
                        j.IndexerProperty<int>("CourseId").HasColumnName("CourseID");
                    });
        });

        modelBuilder.Entity<Survey>(entity =>
        {
            entity.HasKey(e => e.SurveyId).HasName("PK_Survey");

            entity.ToTable("Survey");

            // SurveyID is not an identity column, so new keys are allocated in code.
            entity.Property(e => e.SurveyId)
                .ValueGeneratedNever()
                .HasColumnName("SurveyID");
            entity.Property(e => e.Topic).HasMaxLength(100);
            entity.Property(e => e.Category).HasMaxLength(50);

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.SurveysCreated)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Survey_UserAccount");
        });

        modelBuilder.Entity<SurveyAnswer>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SurveyAn__3214EC2724CF67F6");

            entity.ToTable("SurveyAnswer");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.SessionId).HasColumnName("SessionID");
            entity.Property(e => e.QuestionId).HasColumnName("QuestionID");

            entity.HasOne(d => d.Question).WithMany(p => p.SurveyAnswers)
                .HasForeignKey(d => d.QuestionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SurveyAnswer_Question");

            entity.HasOne(d => d.Session).WithMany(p => p.SurveyAnswers)
                .HasForeignKey(d => d.SessionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SurveyAnswer_SurveySession");
        });

        modelBuilder.Entity<SurveySession>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__SurveySe__3214EC27836E06C7");

            entity.ToTable("SurveySession");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.SurveyId).HasColumnName("SurveyID");
            entity.Property(e => e.UserId).HasColumnName("UserID");

            entity.HasOne(d => d.Survey).WithMany(p => p.SurveySessions)
                .HasForeignKey(d => d.SurveyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SurveySession_Survey");

            entity.HasOne(d => d.User).WithMany(p => p.SurveySessions)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SurveySession_UserAccount");
        });

        modelBuilder.Entity<UserAccount>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__UserAcco__3214EC2741546A6A");

            entity.ToTable("UserAccount");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.Address).HasMaxLength(200);
            entity.Property(e => e.PhotoUrl).HasMaxLength(400);
            entity.Property(e => e.Email)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.FirstName).HasMaxLength(50);
            entity.Property(e => e.Language).HasMaxLength(20);
            entity.Property(e => e.LastName).HasMaxLength(50);
            entity.Property(e => e.MiddleName).HasMaxLength(50);
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Phone)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Theme).HasMaxLength(10);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
