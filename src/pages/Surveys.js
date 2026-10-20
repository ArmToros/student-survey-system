import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, HelpCircle, ClipboardList } from 'lucide-react';
import './Surveys.css';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../services/api';

/**
 * Every survey in the database, newest first. The dashboard only shows the five
 * most recent ones, so this is the page that reaches the older ones.
 */
const Surveys = () => {
  const { t } = useLanguage();

  // The API restricts aggregated results to staff, so students never see the link.
  // Results carry no names, so they are open to anyone signed in.
  const canViewResults = true;

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
        <div className="page-header">
          <h1>{t('surveysPage.title')}</h1>
          <p>{t('surveysPage.subtitle')}</p>
        </div>

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
                    <span className={`survey-row-status ${survey.status}`}>
                      {survey.status === 'active'
                        ? t('dashboard.stats.active')
                        : t('dashboard.stats.oneCompleted')}
                    </span>
                  </div>
                </div>
                <div className="survey-row-actions">
                  {survey.status === 'active' && (
                    <Link to={`/surveys/${survey.id}`} className="btn btn-primary">
                      {t('dashboard.takeSurvey')}
                    </Link>
                  )}
                  {canViewResults && survey.responses > 0 && (
                    <Link to={`/results/${survey.id}`} className="btn btn-secondary">
                      {t('dashboard.viewResults')}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Surveys;
