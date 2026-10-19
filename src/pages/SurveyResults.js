import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, BarChart3, Users, Calendar } from 'lucide-react';
import './SurveyResults.css';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../services/api';

const SurveyResults = () => {
  const {t} = useLanguage()
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const response = await apiFetch(`/api/surveys/${id}/results`);

        if (!response.ok) {
          throw new Error('RESULTS_NOT_FOUND');
        }

        const data = await response.json();
        setSurvey(data.survey);
        setResults(data.results || []);
      } catch (error) {
        console.error(error);
        setSurvey(null);
        setResults(null);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [id]);

  const calculatePercentage = (count, total) => {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  const renderQuestionResult = (questionId, questionData) => {
    switch (questionData.type) {
      case 'multiple-choice':
      case 'single-choice':
        return (
          <div className="chart-container">
            <div className="chart-bars">
              {Object.entries(questionData.responses).map(([option, count]) => {
                const percentage = calculatePercentage(count, questionData.total);
                return (
                  <div key={option} className="bar-item">
                    <div className="bar-label">
                      <span className="option-text">{option}</span>
                      <span className="option-count">{count} ({percentage}%)</span>
                    </div>
                    <div className="bar-track">
                      <div 
                        className="bar-fill"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'rating':
        return (
          <div className="rating-chart">
            <div className="rating-bars">
              {Object.entries(questionData.responses).map(([rating, count]) => {
                const percentage = calculatePercentage(count, questionData.total);
                return (
                  <div key={rating} className="rating-bar">
                    <div className="rating-label">{rating}</div>
                    <div className="rating-track">
                      <div 
                        className="rating-fill"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="rating-count">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div className="checkbox-chart">
            <div className="checkbox-bars">
              {Object.entries(questionData.responses).map(([option, count]) => {
                const percentage = calculatePercentage(count, questionData.total);
                return (
                  <div key={option} className="checkbox-bar">
                    <div className="checkbox-label">{option}</div>
                    <div className="checkbox-track">
                      <div 
                        className="checkbox-fill"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="checkbox-count">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="text-responses">
            <h4>{t('form.sample')}</h4>
            <div className="responses-list">
              {questionData.responses.slice(0, 5).map((response, index) => (
                <div key={index} className="response-item">
                  <span className="response-number">{index + 1}.</span>
                  <span className="response-text">"{response}"</span>
                </div>
              ))}
              {questionData.responses.length > 5 && (
                <div className="more-responses">
                  {t('form.and')} {questionData.responses.length - 5} {t('form.more')}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="survey-results">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>{t('form.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!survey || !results) {
    return (
      <div className="survey-results">
        <div className="container">
          <div className="error-message">
            <h2>{t('form.noRes')}</h2>
            <p>{t('form.notExist')}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">
               {t('form.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-results">
      <div className="container">
        <div className="results-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <ArrowLeft size={20} />
            {t('form.back')}
          </button>
          <h1>{survey.title}</h1>
          <p>{survey.description}</p>
        </div>

        <div className="results-stats">
          <div className="stat-card">
            <Users size={24} />
            <div>
              <h3>{survey.totalResponses}</h3>
              <p>{t('form.totalResponses')}</p>
            </div>
          </div>
          <div className="stat-card">
            <Calendar size={24} />
            <div>
              {/* dbo.Survey stores no dates, so both are usually null - show a dash
                  rather than formatting null into 1/1/1970. */}
              <h3>{(() => {
                const date = survey.endDate || survey.createdDate;
                return date ? new Date(date).toLocaleDateString() : '—';
              })()}</h3>
              <p>{survey.endDate ? t('form.endDate') : 'Created'}</p>
            </div>
          </div>
          <div className="stat-card">
            <BarChart3 size={24} />
            <div>
              <h3>{results.length}</h3>
              <p>{t('createSurvey.questions')}</p>
            </div>
          </div>
        </div>

        <div className="results-content">
          <div className="results-actions">
            <button className="btn btn-outline">
              <Download size={20} />
              {t('form.export')}
            </button>
          </div>

          <div className="questions-results">
            {results.map((questionData, index) => (
              <div key={questionData.id || index} className="question-result">
                <div className="question-header">
                  <h3>{t('form.question')} {index + 1}</h3>
                  <span className="response-count">
                    {questionData.total} {t('form.responses')}
                  </span>
                </div>
                <p className="question-text">{questionData.question}</p>
                {renderQuestionResult(questionData.id || index, questionData)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyResults;
