import React, { useCallback, useEffect, useState } from 'react';
import { GraduationCap, BookOpen, BarChart3, MessageCircle } from 'lucide-react';
import './Lecturer.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

const Lecturer = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [activeTool, setActiveTool] = useState(null);

  // Courses are the extra classes this lecturer runs. They live in dbo.Course
  // and are loaded from the API, so adding or deleting one survives a reload -
  // this list used to be two hardcoded entries held in React state.
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleData, setRescheduleData] = useState({ title: '', time: '', focus: '' });
  const [newCourse, setNewCourse] = useState({ title: '', time: '', focus: '' });

  // The API speaks name/schedule/room/focus; this page has always used
  // title/time/focus, so the two shapes are mapped here rather than renaming
  // everything in the markup.
  const toPageCourse = (course) => ({
    id: course.id,
    title: course.name,
    time: [course.schedule, course.room].filter(Boolean).join(' - '),
    focus: course.focus || '',
    courseNumber: course.courseNumber,
    students: course.students
  });

  const loadCourses = useCallback(async () => {
    try {
      const response = await apiFetch('/api/courses?mine=true');
      if (!response.ok) {
        throw new Error('COURSES_FAILED');
      }
      const data = await response.json();
      setCourses(data.map(toPageCourse));
      setCourseError(null);
    } catch (error) {
      console.warn('Unable to load courses', error);
      setCourseError(t('lecturerPage.stats.loadFailed'));
    } finally {
      setLoadingCourses(false);
    }
  }, [t]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

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
  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const response = await apiFetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('DELETE_FAILED');
      }
      await loadCourses();
    } catch (error) {
      console.error(error);
      setCourseError(t('lecturerPage.stats.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReschedule = (course) => {
    setRescheduleId(course.id);
    setRescheduleData({ title: course.title, time: course.time, focus: course.focus });
  };

  const handleSaveReschedule = async () => {
    setSaving(true);
    try {
      const response = await apiFetch(`/api/courses/${rescheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rescheduleData.title,
          schedule: rescheduleData.time,
          focus: rescheduleData.focus
        })
      });
      if (!response.ok) {
        throw new Error('UPDATE_FAILED');
      }
      setRescheduleId(null);
      setRescheduleData({ title: '', time: '', focus: '' });
      await loadCourses();
    } catch (error) {
      console.error(error);
      setCourseError(t('lecturerPage.stats.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddCourse = async () => {
    if (!newCourse.title.trim()) {
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCourse.title,
          schedule: newCourse.time,
          focus: newCourse.focus
        })
      });
      if (!response.ok) {
        throw new Error('CREATE_FAILED');
      }
      setNewCourse({ title: '', time: '', focus: '' });
      await loadCourses();
    } catch (error) {
      console.error(error);
      setCourseError(t('lecturerPage.stats.saveFailed'));
    } finally {
      setSaving(false);
    }
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
                <button onClick={handleAddCourse} disabled={saving || !newCourse.title.trim()}>
                  {t('lecturerPage.stats.addCourse')}
                </button>
              </div>

              {/* Courses List */}
              {courseError && <p className="course-error">{courseError}</p>}
              {loadingCourses && <p>{t('lecturerPage.stats.loading')}</p>}
              {!loadingCourses && courses.length === 0 && (
                <p className="course-empty">{t('lecturerPage.stats.noCourses')}</p>
              )}

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
                        <p className="course-students">
                          {course.courseNumber} - {course.students} {t('lecturerPage.stats.students')}
                        </p>
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
