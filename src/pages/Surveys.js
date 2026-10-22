import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, HelpCircle, ClipboardList, Trash2, Lock, Unlock, UserCheck, CalendarClock } from 'lucide-react';
import './Surveys.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';
import PageHero from '../components/PageHero';

/**
 * Every survey in the database, newest first. The dashboard only shows the five
 * most recent ones, so this is the page that reaches the older ones.
 */
const Surveys = () => {
  const { t } = useLanguage();

  // The API restricts aggregated results to staff, so students never see the link.
  const { user } = useAuth();

  // Results carry no names, so they are open to anyone signed in.
  const canViewResults = true;
  const canDelete = user?.role === 'admin';
  const isStaff = user?.role === 'admin' || user?.role === 'lecturer';
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [participation, setParticipation] = useState(null);
  const [participationBusy, setParticipationBusy] = useState(null);

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    try {
      const response = await apiFetch('/api/surveys');

      if (!response.ok) {
        throw new Error('SURVEYS_API_FAILED');
      }

      setSurveys(await response.json());
    } catch (error) {
      console.warn('Unable to load surveys', error);
      setSurveys([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  // Closing ends a survey without destroying it: no more answers, but the
  // results stay open to everyone. Deleting is the other thing, and it takes
  // the responses with it.
  // Who the survey went to and who has answered. Staff only, and it names
  // people - which is exactly why the results pages do not.
  const openParticipation = async (survey) => {
    setParticipationBusy(survey.id);
    setDeleteError(null);
    try {
      const response = await apiFetch(`/api/surveys/${survey.id}/participation`);
      if (!response.ok) {
        throw new Error('PARTICIPATION_FAILED');
      }
      setParticipation(await response.json());
    } catch (failure) {
      console.error(failure);
      setDeleteError(t('surveysPage.participationFailed'));
    } finally {
      setParticipationBusy(null);
    }
  };

  const toggleSurveyOpen = async (survey) => {
    const closing = survey.status === 'active';
    const question = closing
      ? t('surveysPage.closeConfirm')
      : t('surveysPage.reopenConfirm');

    if (!window.confirm(`${survey.title}

${question}`)) {
      return;
    }

    setClosingId(survey.id);
    setDeleteError(null);
    try {
      const response = await apiFetch(`/api/surveys/${survey.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isClosed: closing })
      });

      if (!response.ok) {
        throw new Error('CLOSE_FAILED');
      }

      await loadSurveys();
    } catch (failure) {
      console.error(failure);
      setDeleteError(t('surveysPage.closeFailed'));
    } finally {
      setClosingId(null);
    }
  };

  const deleteSurvey = async (survey) => {
    const warning = survey.responses > 0
      ? t('surveysPage.deleteConfirmWithResponses').replace('{count}', survey.responses)
      : t('surveysPage.deleteConfirm');

    if (!window.confirm(`${survey.title}\n\n${warning}`)) {
      return;
    }

    setDeletingId(survey.id);
    setDeleteError(null);
    try {
      const response = await apiFetch(`/api/surveys/${survey.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('DELETE_FAILED');
      }
      await loadSurveys();
    } catch (failure) {
      console.error(failure);
      setDeleteError(t('surveysPage.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="surveys-page">
        <div className="container">
          <div className="surveys-state">
            <div className="spinner"></div>
            <p>{t('surveysPage.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="surveys-page">
      <div className="container">
<PageHero
          eyebrow={t('surveysPage.eyebrow')}
          title={t('surveysPage.title')}
          subtitle={t('surveysPage.subtitle')}
          chips={[
            t('surveysPage.countChip').replace('{count}', surveys.length),
            surveys.some(item => item.alreadyAnswered)
              ? t('surveysPage.answeredChip').replace(
                  '{count}', surveys.filter(item => item.alreadyAnswered).length)
              : null
          ]}
        />

        {deleteError && <p className="surveys-error">{deleteError}</p>}

        {failed && (
          <div className="surveys-state">
            <ClipboardList size={40} />
            <h2>{t('surveysPage.error')}</h2>
            <p>{t('surveysPage.errorDesc')}</p>
            <button type="button" className="btn btn-primary" onClick={loadSurveys}>
              {t('surveysPage.retry')}
            </button>
          </div>
        )}

        {!failed && surveys.length === 0 && (
          <div className="surveys-state">
            <ClipboardList size={40} />
            <h2>{t('surveysPage.empty')}</h2>
            <p>{t('surveysPage.emptyDesc')}</p>
          </div>
        )}

        {!failed && surveys.length > 0 && (
          <div className="surveys-list">
            {surveys.map(survey => (
              <div key={survey.id} className="survey-row">
                <div className="survey-row-info">
                  <h2 className="survey-row-title">{survey.title}</h2>
                  <div className="survey-row-meta">
                    <span className="survey-row-metric">
                      <HelpCircle size={16} />
                      {survey.questionCount} {t('surveysPage.questions')}
                    </span>
                    <span className="survey-row-metric">
                      <Users size={16} />
                      {survey.responses} {t('dashboard.responses')}
                    </span>
                    {survey.category && (
                      <span className="survey-category">{survey.category}</span>
                    )}
                    {survey.deadline && (
                      <span className="survey-row-metric">
                        <CalendarClock size={16} />
                        {t('surveysPage.closesOn').replace(
                          '{date}', new Date(survey.deadline).toLocaleDateString())}
                      </span>
                    )}
                    <span className={`survey-row-status ${survey.status}`}>
                      {survey.status === 'active'
                        ? t('dashboard.stats.active')
                        : t('surveysPage.closedNotice')}
                    </span>
                  </div>
                </div>
                <div className="survey-row-actions">
                  {survey.status === 'active' && !survey.alreadyAnswered && (
                    <Link to={`/surveys/${survey.id}`} className="btn btn-primary">
                      {t('dashboard.takeSurvey')}
                    </Link>
                  )}
                  {survey.alreadyAnswered && (
                    <span className="survey-answered">{t('surveysPage.answered')}</span>
                  )}
                  {canViewResults && survey.responses > 0 && (
                    <Link to={`/results/${survey.id}`} className="btn btn-secondary">
                      {t('dashboard.viewResults')}
                    </Link>
                  )}
                  {isStaff && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => openParticipation(survey)}
                      disabled={participationBusy === survey.id}
                      title={t('surveysPage.participation')}
                    >
                      <UserCheck size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => toggleSurveyOpen(survey)}
                      disabled={closingId === survey.id}
                      title={survey.status === 'active'
                        ? t('surveysPage.close')
                        : t('surveysPage.reopen')}
                    >
                      {survey.status === 'active' ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteSurvey(survey)}
                      disabled={deletingId === survey.id}
                      title={t('surveysPage.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {participation && (
          <div className="participation-overlay" onClick={() => setParticipation(null)}>
            <div className="participation-panel" onClick={(event) => event.stopPropagation()}>
              <div className="participation-header">
                <h2>{participation.title}</h2>
                <button className="btn btn-secondary" onClick={() => setParticipation(null)}>
                  {t('surveysPage.close')}
                </button>
              </div>

              <p className="participation-summary">
                {t('surveysPage.participationSummary')
                  .replace('{answered}', participation.answeredCount)
                  .replace('{total}', participation.total)}
                {participation.deadline && ' ' + t('surveysPage.closesOn').replace(
                  '{date}', new Date(participation.deadline).toLocaleDateString())}
              </p>

              <ul className="participation-list">
                {participation.people.map(person => (
                  <li key={person.id} className={person.answered ? 'has-answered' : 'not-answered'}>
                    <span className="participation-name">{person.name}</span>
                    <span className="participation-email">{person.email}</span>
                    <span className="participation-state">
                      {person.answered
                        ? t('surveysPage.answered')
                        : t('surveysPage.notAnswered')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Surveys;
