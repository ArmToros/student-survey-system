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
  const { login, credentialHints, requestPasswordReset, register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [registerFormData, setRegisterFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryRef = useRef(null);
  const registerRef = useRef(null);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setRegisterError('');
  };

  const toggleRecoveryMode = () => {
    setIsRecoveryMode((prev) => !prev);
    setRecoveryEmail('');
    setRecoveryMessage('');
    setRecoveryError('');
  };

  const toggleRegisterMode = () => {
    setIsRegisterMode((prev) => !prev);
    setRegisterFormData({ name: '', email: '', password: '', confirmPassword: '' });
    setRegisterError('');
    setRegisterSuccess('');
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

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');

    // Validation
    if (!registerFormData.name || !registerFormData.email || !registerFormData.password || !registerFormData.confirmPassword) {
      setRegisterError(t('register.errors.required'));
      return;
    }

    if (registerFormData.password !== registerFormData.confirmPassword) {
      setRegisterError(t('register.errors.passwordMismatch') );
      return;
    }

    if (registerFormData.password.length < 6) {
      setRegisterError(t('register.errors.passwordTooShort'));
      return;
    }

    try {
      setIsRegistering(true);
      await register(registerFormData.name, registerFormData.email, registerFormData.password);
      setRegisterSuccess(t('register.success') );
      
      // Reset form and switch to login
      setTimeout(() => {
        setRegisterFormData({ name: '', email: '', password: '', confirmPassword: '' });
        setFormData({ email: registerFormData.email, password: registerFormData.password });
        setIsRegisterMode(false);
      }, 1500);
    } catch (err) {
      const code = err?.message;
      if (code === 'EMAIL_ALREADY_EXISTS') {
        setRegisterError(t('register.errors.emailExists'));
      } else if (code === 'INVALID_EMAIL') {
        setRegisterError(t('register.errors.invalidEmail'));
      } else if (code === 'NETWORK_ERROR') {
        setRegisterError(t('register.errors.networkError'));
      } else if (code === 'SERVER_ERROR' || code === 'INVALID_RESPONSE') {
        setRegisterError(t('register.errors.serverError'));
      } else {
        setRegisterError(t('register.errors.generic'));
      }
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (isRecoveryMode && recoveryRef.current) {
      recoveryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    if (isRegisterMode && registerRef.current) {
      registerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isRegisterMode]);

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

          <div className="login-footer">
            <p>
              {t('login.noAccount')}{' '}
              <button type="button" className="signup-link" onClick={toggleRegisterMode}>
                {t('login.signUp')}
              </button>
            </p>
          </div>

          {isRegisterMode && (
            <div className="register-panel" ref={registerRef}>
              <div className="register-panel-header">
                <h3>{t('register.title') || 'Create Account'}</h3>
                <p>{t('register.subtitle') || 'Join our community'}</p>
              </div>
              <form className="register-form" onSubmit={handleRegisterSubmit}>
                {registerError && (
                  <div className="error-message">
                    <AlertTriangle size={18} />
                    {registerError}
                  </div>
                )}

                {registerSuccess && (
                  <div className="success-message">
                    <CheckCircle size={18} />
                    {registerSuccess}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="reg-name" className="form-label">
                    <UserPlus size={18} />
                    {t('register.name') || 'Full Name'}
                  </label>
                  <input
                    type="text"
                    id="reg-name"
                    name="name"
                    value={registerFormData.name}
                    onChange={handleRegisterChange}
                    placeholder={t('register.namePlaceholder') }
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-email" className="form-label">
                    <Mail size={18} />
                    {t('register.email') || 'Email Address'}
                  </label>
                  <input
                    type="email"
                    id="reg-email"
                    name="email"
                    value={registerFormData.email}
                    onChange={handleRegisterChange}
                    placeholder={t('register.emailPlaceholder')}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-password" className="form-label">
                    <Lock size={18} />
                    {t('register.password') || 'Password'}
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      id="reg-password"
                      name="password"
                      value={registerFormData.password}
                      onChange={handleRegisterChange}
                      placeholder={t('register.passwordPlaceholder')}
                      className="form-input"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegisterPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-confirm-password" className="form-label">
                    <Lock size={18} />
                    {t('register.confirmPassword') }
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showRegisterConfirmPassword ? 'text' : 'password'}
                      id="reg-confirm-password"
                      name="confirmPassword"
                      value={registerFormData.confirmPassword}
                      onChange={handleRegisterChange}
                      placeholder={t('register.confirmPasswordPlaceholder')}
                      className="form-input"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                      aria-label={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegisterConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="register-panel-actions">
                  <button type="submit" className="register-submit-button" disabled={isRegistering}>
                    {isRegistering ? (t('register.registering') || 'Creating Account...') : (t('register.registerButton') || 'Create Account')}
                  </button>
                  <button type="button" className="register-cancel-button" onClick={toggleRegisterMode}>
                    {t('register.back')}
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
