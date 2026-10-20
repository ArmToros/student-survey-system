import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Clock, MapPin, User, Users } from 'lucide-react';
import './Courses.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

/**
 * The extra classes lecturers run, and the place students join them.
 *
 * Everyone signed in can see the list. Only students can join or leave, because
 * enrolment is a dbo.StudentCourse row and that table hangs off StudentData.
 * The ten courses restored from the backup have no lecturer, so they are shown
 * as part of the catalogue but carry no "run by" line.
 */
const Courses = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const isStudent = user?.role === 'student';

  const loadCourses = useCallback(async () => {
    try {
      const response = await apiFetch('/api/courses');
      if (!response.ok) {
        throw new Error('COURSES_FAILED');
      }
      setCourses(await response.json());
      setError(null);
    } catch (loadError) {
      console.warn('Unable to load courses', loadError);
      setError(t('courses.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const toggleEnrolment = async (course) => {
    setBusyId(course.id);
    try {
      const response = await apiFetch(`/api/courses/${course.id}/enrollment`, {
        method: course.enrolled ? 'DELETE' : 'POST'
      });

      if (!response.ok) {
        throw new Error('ENROLMENT_FAILED');
      }

      await loadCourses();
    } catch (enrolError) {
      console.error(enrolError);
      setError(course.enrolled ? t('courses.leaveFailed') : t('courses.joinFailed'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="courses">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>{t('courses.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="courses">
      <div className="container">
        <div className="page-header">
          <h1>{t('courses.title')}</h1>
          <p>{t('courses.subtitle')}</p>
        </div>

        {error && <p className="courses-error">{error}</p>}

        {courses.length === 0 ? (
          <div className="no-courses">
            <BookOpen size={64} />
            <h3>{t('courses.none')}</h3>
          </div>
        ) : (
          <div className="courses-grid">
            {courses.map(course => (
              <div key={course.id} className={`course-card ${course.enrolled ? 'enrolled' : ''}`}>
                <div className="course-card-top">
                  <span className="course-code">{course.courseNumber}</span>
                  {course.enrolled && (
                    <span className="course-badge">{t('courses.joined')}</span>
                  )}
                </div>

                <h3>{course.name}</h3>

                {course.focus && <p className="course-focus">{course.focus}</p>}

                <div className="course-meta">
                  {course.lecturerName && (
                    <span><User size={14} /> {course.lecturerName}</span>
                  )}
                  {course.schedule && (
                    <span><Clock size={14} /> {course.schedule}</span>
                  )}
                  {course.room && (
                    <span><MapPin size={14} /> {course.room}</span>
                  )}
                  <span><Users size={14} /> {course.students} {t('courses.students')}</span>
                </div>

                {isStudent && (
                  <button
                    className={`btn ${course.enrolled ? 'btn-outline' : 'btn-primary'}`}
                    onClick={() => toggleEnrolment(course)}
                    disabled={busyId === course.id}
                  >
                    {course.enrolled ? t('courses.leave') : t('courses.join')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
