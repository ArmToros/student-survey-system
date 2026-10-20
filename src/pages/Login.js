import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, UserPlus } from 'lucide-react';
import './Login.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, credentialHints, requestPasswordReset } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryRef = useRef(null);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const toggleRecoveryMode = () => {
    setIsRecoveryMode((prev) => !prev);
    setRecoveryEmail('');
    setRecoveryMessage('');
    setRecoveryError('');
  };

const handleRecoverySubmit = async (e) => {
  e.preventDefault();
  setRecoveryMessage('');
  setRecoveryError('');

  if (!recoveryEmail) {
    setRecoveryError(t('register.emailPlaceholder'));
    return;
  }

  try {
    setIsRecovering(true);
    await requestPasswordReset(recoveryEmail);

    // Always the same message: saying whether the address is registered would
    // let anyone discover which accounts exist.
    setRecoveryMessage(t('login.recovery.submitted'));
  } catch (err) {
    setRecoveryError(err?.message === 'TOO_MANY_ATTEMPTS'
      ? t('login.errors.tooManyAttempts')
      : t('register.errors.failedSend'));
  } finally {
    setIsRecovering(false);
  }
};

  useEffect(() => {
    if (isRecoveryMode && recoveryRef.current) {
      recoveryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isRecoveryMode]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setError(t('login.errors.required'));
      setIsLoading(false);
      return;
    }

    try {
      await login(formData.email, formData.password);
      const redirectPath = location.state?.from?.pathname || '/';
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err?.message === 'TOO_MANY_ATTEMPTS'
        ? t('login.errors.tooManyAttempts')
        : t('login.errors.invalid'));
    } finally {
      setIsLoading(false);
    }
  };

  const autofillCredentials = (email, password) => {
    setFormData({ email, password });
    setError('');
  };
  return (
    <div className="login">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">
              <LogIn size={48} />
            </div>
            <h1>{t('login.title')}</h1>
            <p>{t('login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <Mail size={18} />
                {t('login.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('login.emailPlaceholder')}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <Lock size={18} />
                {t('login.password')}
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={t('login.passwordPlaceholder')}
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>{t('login.rememberMe')}</span>
              </label>
              <button type="button" className="forgot-password" onClick={toggleRecoveryMode}>
                {t('login.forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? t('login.loggingIn') : t('login.loginButton')}
            </button>
          </form>

          {credentialHints.length > 0 && (
          <div className="quick-access">
            <div className="quick-access-header">
              <h3>{t('login.quickAccessTitle')}</h3>
              <p>{t('login.quickAccessSubtitle')}</p>
            </div>
            <div className="quick-access-grid">
              {credentialHints.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  className="quick-access-card"
                  onClick={() => autofillCredentials(item.email, item.password)}
                >
                  <div className="quick-access-role">{t(`header.roleLabels.${item.role}`)}</div>
                  <div className="quick-access-name">{item.name}</div>
                  <div className="quick-access-credentials">
                    <span>{item.email}</span>
                    <span>{item.password}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          )}

          {isRecoveryMode && (
            <div className="password-recovery" ref={recoveryRef}>
              <div className="password-recovery-header">
                <h3>{t('login.recovery.title')}</h3>
                <p>{t('login.recovery.subtitle')}</p>
              </div>
              <form className="password-recovery-form" onSubmit={handleRecoverySubmit}>
                <label htmlFor="recovery-email" className="form-label">
                  <Mail size={18} />
                  {t('login.recovery.emailLabel')}
                </label>
                <input
                  type="email"
                  id="recovery-email"
                  value={recoveryEmail}
                  onChange={(event) => {
                    setRecoveryEmail(event.target.value);
                    setRecoveryError('');
                    setRecoveryMessage('');
                  }}
                  placeholder={t('login.recovery.emailPlaceholder')}
                  className="form-input"
                />
                {recoveryMessage && (
                  <div className="recovery-status success">
                    <CheckCircle size={18} />
                    <span>{recoveryMessage}</span>
                  </div>
                )}
                {recoveryError && (
                  <div className="recovery-status error">
                    <AlertTriangle size={18} />
                    <span>{recoveryError}</span>
                  </div>
                )}
                <div className="password-recovery-actions">
                  <button type="submit" className="recovery-button" disabled={isRecovering}>
                    {isRecovering ? t('login.recovery.sending') : t('login.recovery.submit')}
                  </button>
                  <button type="button" className="recovery-cancel" onClick={toggleRecoveryMode}>
                    {t('login.recovery.back')}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
