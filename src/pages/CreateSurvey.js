/**
 * Writing a survey. Admins only; the route is guarded and the API checks again.
 *
 * Two fields matter beyond the questions. The audience limits who may answer,
 * and leaving every role unticked means everybody - the same rule news uses.
 * The closing date is optional, and a survey past it closes itself and stops
 * accepting answers.
 *
 * Question ids here are React keys only. The server assigns the real ones, and
 * sending a Date.now() value is how survey creation used to fail with a 400.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Eye } from 'lucide-react';
import './CreateSurvey.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';
const CreateSurvey = () =>{
  const {t} = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState({
    title: '',
    description: '',
    category: 'Academic',
    deadline: '',
    // Empty means everyone, matching how the API reads a survey with no
    // audience rows.
    audience: [],
    questions: []
  });
  const [saving, setSaving] = useState(false);

  // What is wrong with the form right now: { title, questions: {id: {...}} }.
  // Empty means nothing is wrong. Populated only after a save attempt, so the
  // form is not scolding somebody who has not finished typing yet.
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);

  const questionTypes = [
    { value: 'single-choice', label: t('createSurvey.single') },
    { value: 'multiple-choice', label: t('createSurvey.multiple') },
    { value: 'text', label: t('createSurvey.textInput') },
    { value: 'rating', label: t('createSurvey.ratingScale')  }
  ];

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      type: 'single-choice',
      question: '',
      options: ['Option 1', 'Option 2'],
      required: true,
      placeholder: ''
    };
    
    setSurvey(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const updateQuestion = (questionId, field, value) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, [field]: value } : q
      )
    }));
  };

  const removeQuestion = (questionId) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const addOption = (questionId) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }
          : q
      )
    }));
  };

  const updateOption = (questionId, optionIndex, value) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              options: q.options.map((opt, idx) => 
                idx === optionIndex ? value : opt
              )
            }
          : q
      )
    }));
  };

  const removeOption = (questionId, optionIndex) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              options: q.options.filter((_, idx) => idx !== optionIndex)
            }
          : q
      )
    }));
  };

  /**
   * Everything the API would refuse, checked here first so the person is told
   * which box to fix rather than that something went wrong.
   *
   * The API drops questions whose text is blank, so a form with one empty
   * question used to post successfully, come back 400 "at least one question is
   * required", and show a message about the database. The real fault was an
   * empty box on screen.
   */
  const validate = () => {
    const found = { questions: {} };

    if (!survey.title.trim()) {
      found.title = t('createSurvey.errors.titleRequired');
    }

    if (survey.questions.length === 0) {
      found.noQuestions = t('createSurvey.addOneQuestion');
    }

    survey.questions.forEach(question => {
      const problems = {};

      if (!question.question.trim()) {
        problems.question = t('createSurvey.errors.questionRequired');
      }

      // A choice question with nothing to choose between is not answerable.
      if (['single-choice', 'multiple-choice', 'checkbox'].includes(question.type)) {
        const filled = (question.options || []).filter(option => option.trim());
        if (filled.length < 2) {
          problems.options = t('createSurvey.errors.optionsRequired');
        }
      }

      if (Object.keys(problems).length > 0) {
        found.questions[question.id] = problems;
      }
    });

    const hasAny = Boolean(found.title) || Boolean(found.noQuestions)
      || Object.keys(found.questions).length > 0;

    return hasAny ? found : null;
  };

  const handleSave = async () => {
    setSaveError(null);

    const found = validate();
    if (found) {
      setErrors(found);

      // Put the first bad field on screen and in focus, so a long form does
      // not leave somebody hunting for the red box.
      window.requestAnimationFrame(() => {
        const field = document.querySelector('.field-invalid');
        if (field) {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof field.focus === 'function') {
            field.focus({ preventScroll: true });
          }
        }
      });
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      const response = await apiFetch('/api/surveys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: survey.title,
          description: survey.description,
          category: survey.category,
          audience: survey.audience,
          // A date box gives a local date with no time; send the end of that
          // day in UTC, so "closes on the 30th" means the 30th is still usable.
          deadline: survey.deadline
            ? new Date(`${survey.deadline}T23:59:59`).toISOString()
            : null,
          createdBy: user?.dbId,
          assignedAdmin: user?.role === 'admin' ? user?.dbId : undefined,
          // The question id here is only a local React key. The server assigns the
          // real QuestionID, and rejects a Date.now() value as too large for it.
          questions: survey.questions.map(({ id, ...question }) => question)
        })
      });

      if (!response.ok) {
        // The API explains itself; pass that on rather than guessing at the
        // cause. Only a request that never arrived gets the generic line.
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'CREATE_SURVEY_FAILED');
      }

      navigate('/');
    } catch (error) {
      console.error(error);
      setSaveError(error.message === 'CREATE_SURVEY_FAILED' || error.message === 'API_NETWORK_ERROR'
        ? t('createSurvey.errors.saveFailed')
        : error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderQuestionOptions = (question) => {
    if (question.type === 'text') {
      return (
        <div className="form-group">
          <label className="form-label">{t('createSurvey.placeholderText')}</label>
          <input
            type="text"
            className="form-input"
            value={question.placeholder}
            onChange={(e) => updateQuestion(question.id, 'placeholder', e.target.value)}
            placeholder={t('createSurvey.text')}
          />
        </div>
      );
    }

    if (question.type === 'rating') {
      return (
        <div className="form-group">
          <label className="form-label">{t('createSurvey.ratingScale')}</label>
          <div className="rating-config">
            <div>
              <label> {t('createSurvey.minValue')}</label>
              <input
                type="number"
                className="form-input"
                value={question.min || 1}
                onChange={(e) => updateQuestion(question.id, 'min', parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div>
              <label>{t('createSurvey.maxValue')}</label>
              <input
                type="number"
                className="form-input"
                value={question.max || 5}
                onChange={(e) => updateQuestion(question.id, 'max', parseInt(e.target.value))}
                min="2"
              />
            </div>
          </div>
        </div>
      );
    }

    if (['single-choice', 'multiple-choice', 'checkbox'].includes(question.type)) {
      return (
        <div className="form-group">
          <label className="form-label">{t('createSurvey.options')}</label>
          {errors.questions?.[question.id]?.options && (
            <p className="field-error">{errors.questions[question.id].options}</p>
          )}
          <div className={`options-list ${errors.questions?.[question.id]?.options ? 'options-invalid' : ''}`}>
            {question.options.map((option, index) => (
              <div key={index} className="option-item">
                <input
                  type="text"
                  className="form-input"
                  value={option}
                  onChange={(e) => updateOption(question.id, index, e.target.value)}
                  placeholder={t('createSurvey.option') +  ' ' + `${index + 1}`}
                />
                {question.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(question.id, index)}
                    className="remove-option-btn"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(question.id)}
              className="add-option-btn"
            >
              <Plus size={16} />
              {t('createSurvey.addOption')}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="create-survey">
      <div className="container">
        <div className="page-header">
          <h1>{t('createSurvey.pageTitle')}</h1>
          <p>{t('createSurvey.pageDescription')}</p>
        </div>

        <div className="survey-builder">
          <div className="survey-info">
            <div className="card">
              <h2>{t('createSurvey.surveyInformation')}</h2>
              <div className="form-group">
                <label className="form-label">{t('createSurvey.surveyTitle')}</label>
                <input
                  type="text"
                  className={`form-input ${errors.title ? 'field-invalid' : ''}`}
                  value={survey.title}
                  onChange={(e) => {
                    setSurvey(prev => ({ ...prev, title: e.target.value }));
                    // Clear the mark as soon as it is being fixed.
                    if (errors.title) {
                      setErrors(prev => ({ ...prev, title: undefined }));
                    }
                  }}
                  placeholder={t('createSurvey.enterTitle')}
                />
                {errors.title && <p className="field-error">{errors.title}</p>}
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('createSurvey.surveyDescription')}</label>
                <textarea
                  className="form-textarea"
                  value={survey.description}
                  onChange={(e) => setSurvey(prev => ({ ...prev, description: e.target.value }))}
                  placeholder= {t('createSurvey.desc')}
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('createSurvey.surveyCategory')}</label>
                <select
                  className="form-input"
                  value={survey.category}
                  onChange={(e) => setSurvey(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="Academic">{t('createSurvey.academic')}</option>
                  <option value="Services">{t('createSurvey.services')}</option>
                  <option value="Infrastructure">{t('createSurvey.infrastructure')}</option>
                  <option value="Student Life">{t('createSurvey.studentLife')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('createSurvey.deadline')}</label>
                <p className="form-hint">{t('createSurvey.deadlineHint')}</p>
                <input
                  type="date"
                  className="form-input"
                  value={survey.deadline}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSurvey(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>{t('createSurvey.audience')}</label>
                <p className="form-hint">{t('createSurvey.audienceHint')}</p>
                <div className="audience-options">
                  {['Student', 'Lecturer', 'Admin'].map(role => (
                    <label key={role} className="audience-option">
                      <input
                        type="checkbox"
                        checked={survey.audience.includes(role)}
                        onChange={(event) => setSurvey(prev => ({
                          ...prev,
                          audience: event.target.checked
                            ? [...prev.audience, role]
                            : prev.audience.filter(item => item !== role)
                        }))}
                      />
                      <span>{t(`header.roleLabels.${role.toLowerCase()}`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="questions-section">
            <div className="section-header">
              <h2>{t('createSurvey.questions')} ({survey.questions.length})</h2>
              <button onClick={addQuestion} className="btn btn-primary">
                <Plus size={20} />
                {t('createSurvey.addQuestion')}
              </button>
            </div>

            {survey.questions.length === 0 ? (
              <div className="no-questions">
                <p>{t('createSurvey.noQuestions')}</p>
              </div>
            ) : (
              <div className="questions-list">
                {survey.questions.map((question, index) => (
                  <div key={question.id} className="question-card">
                    <div className="question-header">
                      <div className="question-number">Q{index + 1}</div>
                      <button
                        onClick={() => removeQuestion(question.id)}
                        className="remove-question-btn"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="question-content">
                      <div className="form-group">
                        <label className="form-label">{t('createSurvey.questionText')}</label>
                        <input
                          type="text"
                          className={`form-input ${errors.questions?.[question.id]?.question ? 'field-invalid' : ''}`}
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                          placeholder={t('createSurvey.enterQuestion')}
                        />
                        {errors.questions?.[question.id]?.question && (
                          <p className="field-error">{errors.questions[question.id].question}</p>
                        )}
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">{t('createSurvey.questionType')}</label>
                        <select
                          className="form-input"
                          value={question.type}
                          onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
                        >
                          {questionTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {renderQuestionOptions(question)}
                      
                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => updateQuestion(question.id, 'required', e.target.checked)}
                          />
                          <span>{t('createSurvey.requiredQuestion')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(errors.title || errors.noQuestions
            || Object.keys(errors.questions || {}).length > 0) && (
            <div className="form-summary-error">
              {errors.noQuestions || t('createSurvey.errors.summary')}
            </div>
          )}
          {saveError && <div className="form-summary-error">{saveError}</div>}

          <div className="survey-actions">
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary"
            >
              {t('createSurvey.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <div className="spinner"></div>
                  {t('createSurvey.saving')}
                </>
              ) : (
                <>
                  <Save size={20} />
                 {t('createSurvey.saveSurvey')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSurvey;
