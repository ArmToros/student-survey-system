import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import './SurveyForm.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

const SurveyForm = () => {
  const {t} = useLanguage();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fallbackSurvey = {
      id: parseInt(id, 10),
      title: t('form.title'),
      description: t('form.description'),
      questions: []
    };

    const loadSurvey = async () => {
      try {
        const response = await apiFetch(`/api/surveys/${id}`);

        if (!response.ok) {
          throw new Error('SURVEY_NOT_FOUND');
        }

        const data = await response.json();
        setSurvey({
          ...data,
          questions: (data.questions || []).map((question, index) => ({
            ...question,
            id: index + 1,
            min: question.min || 1,
            max: question.max || 5,
            options: question.options || []
          }))
        });
      } catch (error) {
        console.warn('Unable to load survey from API', error);
        setSurvey(fallbackSurvey);
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, [id, t]);

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentQuestion < survey.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/surveys/${id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user?.dbId, responses })
      });

      if (!response.ok) {
        throw new Error('SUBMIT_SURVEY_FAILED');
      }

      setShowSuccess(true);

      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error(error);
      alert('Could not submit survey response to the database. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    switch (question.type) {
      case 'single-choice':
        return (
          <div className="question-options">
            {question.options.map((option, index) => (
              <label key={index} className="radio-item">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  checked={responses[question.id] === option}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'multiple-choice':
        return (
          <div className="question-options">
            {question.options.map((option, index) => (
              <label key={index} className="radio-item">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  checked={responses[question.id] === option}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="question-options">
            {question.options.map((option, index) => {
              const currentValues = responses[question.id] || [];
              const isChecked = currentValues.includes(option);
              
              return (
                <label key={index} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...currentValues, option]
                        : currentValues.filter(v => v !== option);
                      handleResponseChange(question.id, newValues);
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        );

      case 'text':
        return (
          <textarea
            className="form-textarea"
            placeholder={question.placeholder}
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
          />
        );

      case 'rating':
        return (
          <div className="rating-scale">
            {Array.from({ length: question.max - question.min + 1 }, (_, i) => {
              const value = i + question.min;
              return (
                <label key={value} className="rating-item">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={value}
                    checked={responses[question.id] === value}
                    onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
                  />
                  <span className="rating-number">{value}</span>
                </label>
              );
            })}
            <div className="rating-labels">
              <span>{t('form.poor')}</span>
              <span>{t('form.excellent')}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="survey-form">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>{t('form.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="survey-form">
        <div className="container">
          <div className="success-message">
            <CheckCircle size={64} />
            <h2>{t('form.thanks')}</h2>
            <p>{t('form.submit')}</p>
            <p>{t('form.redirecting')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!survey || survey.questions.length === 0) {
    return (
      <div className="survey-form">
        <div className="container">
          <div className="error-message">
            <AlertCircle size={64} />
            <h2>{t('form.notFound')}</h2>
            <p>{t('form.deleted')}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">
             {t('form.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = survey.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / survey.questions.length) * 100;

  return (
    <div className="survey-form">
      <div className="container">
        <div className="survey-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <ArrowLeft size={20} />
            {t('form.back')}
          </button>
          <h1>{survey.title}</h1>
          <p>{survey.description}</p>
        </div>

        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">
            {t('form.question')} {currentQuestion + 1} {t('form.of')} {survey.questions.length}
          </span>
        </div>

        <div className="question-container">
          <div className="question-header">
            <h2>{currentQ.question}</h2>
            {currentQ.required && <span className="required">{t('form.required')}</span>}
          </div>

          <div className="question-content">
            {renderQuestion(currentQ)}
          </div>

          <div className="question-navigation">
            <button 
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="btn btn-secondary"
            >
              {t('form.previous')}
            </button>

            {currentQuestion === survey.questions.length - 1 ? (
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? (
                  <>
                    <div className="spinner"></div>
                    {t('form.submitting')}
                  </>
                ) : (
                  'Submit Survey'
                )}
              </button>
            ) : (
              <button 
                onClick={handleNext}
                className="btn btn-primary"
              >
                {t('form.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyForm;
