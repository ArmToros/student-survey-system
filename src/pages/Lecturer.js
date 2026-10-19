import React, { useState } from 'react';
import { GraduationCap, BookOpen, BarChart3, MessageCircle } from 'lucide-react';
import './Lecturer.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const Lecturer = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [activeTool, setActiveTool] = useState(null);
  const [courses, setCourses] = useState([
    { id: 1, title: t('lecturerPage.stats.algorithms'), time: '09:00 •' + t('lecturerPage.stats.room') + 'B214', focus: t('lecturerPage.schedule.algorithms') },
    { id: 2, title: t('lecturerPage.stats.capstone'), time: '13:00 •' + t('lecturerPage.stats.innovation'), focus: t('lecturerPage.schedule.capstone') }
  ]);

  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleData, setRescheduleData] = useState({ title: '', time: '', focus: '' });
  const [newCourse, setNewCourse] = useState({ title: '', time: '', focus: '' });

  const analytics = user?.analytics || {};

  // Tool buttons including Statistics
  const tools = [
    {
      id: 'viewCourses',
      title: t('lecturerPage.tools.survey.title'),
      description: t('lecturerPage.tools.survey.description'),
      icon: GraduationCap
    },
    {
      id: 'statistics',
      title: t('lecturerPage.tools.feedback.title'),
      description: t('lecturerPage.tools.feedback.description'),
      icon: BarChart3
    }
  ];

  // --- Course Handlers ---
  const handleDelete = (id) => setCourses(courses.filter(c => c.id !== id));

  const handleReschedule = (course) => {
    setRescheduleId(course.id);
    setRescheduleData({ ...course });
  };

  const handleSaveReschedule = () => {
    setCourses(courses.map(c => (c.id === rescheduleId ? rescheduleData : c)));
    setRescheduleId(null);
    setRescheduleData({ title: '', time: '', focus: '' });
  };

  const handleAddCourse = () => {
    const newId = courses.length > 0 ? Math.max(...courses.map(c => c.id)) + 1 : 1;
    setCourses([...courses, { id: newId, ...newCourse }]);
    setNewCourse({ title: '', time: '', focus: '' });
  };

  return (
    <div className="lecturer-page">
      {/* Hero Section */}
      <section className="lecturer-hero">
        <div className="lecturer-hero-text">
          <p className="lecturer-hero-label">{t('lecturerPage.eyebrow')}</p>
          <h1>{t('lecturerPage.title')}</h1>
          <p>{t('lecturerPage.subtitle')}</p>
          <div className="lecturer-meta">
            <span>{user?.department}</span>
            <span>{user?.email}</span>
          </div>
        </div>
        <div className="lecturer-hero-profile">
          {user?.avatar && <img src={user.avatar} alt={user.firstName} className="lecturer-avatar" />}
          <div>
            <div className="lecturer-hero-name">{user?.firstName} {user?.lastName}</div>
            <div className="lecturer-hero-role">{user?.roleLabel}</div>
            <div className="lecturer-hero-id">{user?.studentId}</div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      {!activeTool && (
        <section className="lecturer-tools">
          <div className="lecturer-section-head">
            <h2>{t('lecturerPage.toolsTitle')}</h2>
          </div>
          <div className="lecturer-tools-grid">
            {tools.map(({ id, title, description, icon: Icon }) => (
              <button key={id} className="lecturer-tool-card" onClick={() => setActiveTool(id)}>
                <div className="lecturer-tool-icon"><Icon size={20} /></div>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tool Panel */}
      {activeTool && (
        <section className="lecturer-tool-panel">
          <button className="lecturer-back-button" onClick={() => setActiveTool(null)}>← {t('adminPage.back')}</button>

          {activeTool === 'viewCourses' && (
            <div className="courses-panel">
              <h2>{t('lecturerPage.stats.viewCourses')}</h2>

              {/* Add Course Form */}
              <div className="add-course-form">
                <h3>{t('lecturerPage.stats.addCourse')}</h3>
                <input
                  type="text"
                  placeholder={t('lecturerPage.stats.courseTitle')}
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                />
                <input
                  type="text"
                  placeholder={t('lecturerPage.stats.time')}
                  value={newCourse.time}
                  onChange={(e) => setNewCourse({ ...newCourse, time: e.target.value })}
                />
                <input
                  type="text"
                  placeholder={t('lecturerPage.stats.focus')}
                  value={newCourse.focus}
                  onChange={(e) => setNewCourse({ ...newCourse, focus: e.target.value })}
                />
                <button onClick={handleAddCourse}>{t('lecturerPage.stats.addCourse')}</button>
              </div>

              {/* Courses List */}
              <ul className="sessions-list">
                {courses.map((course) => (
                  <li key={course.id} className="session-item">
                    {rescheduleId === course.id ? (
                      <div className="reschedule-form">
                        <input
                          type="text"
                          value={rescheduleData.title}
                          onChange={(e) => setRescheduleData({ ...rescheduleData, title: e.target.value })}
                        />
                        <input
                          type="text"
                          value={rescheduleData.time}
                          onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                        />
                        <input
                          type="text"
                          value={rescheduleData.focus}
                          onChange={(e) => setRescheduleData({ ...rescheduleData, focus: e.target.value })}
                        />
                        <button onClick={handleSaveReschedule}>{t('lecturerPage.stats.save')}</button>
                        <button onClick={() => setRescheduleId(null)}>{t('lecturerPage.stats.cancel')}</button>
                      </div>
                    ) : (
                      <div className="course-info">
                        <h3>{course.title}</h3>
                        <p>{course.time}</p>
                        <p>{course.focus}</p>
                        <button onClick={() => handleReschedule(course)}>{t('lecturerPage.stats.reschedule')}</button>
                        <button onClick={() => handleDelete(course.id)}>{t('lecturerPage.stats.delete')}</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTool === 'statistics' && (
            <div className="statistics-panel">
              <h2>{t('lecturerPage.stats.statistics')}</h2>
              <p>{t('lecturerPage.stats.totalCourses')} {courses.length}</p>
              <p>{t('lecturerPage.stats.totalSurveys')} 12</p>
              <p>{t('lecturerPage.stats.responsesCollected')} 87</p>
              <p>{t('lecturerPage.stats.averageScore')}: 4.5 / 5</p>
            </div>
          )}

        </section>
      )}
    </div>
  );
};

export default Lecturer;
