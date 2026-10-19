import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ResetPassword.css';

/**
 * Finishes a password reset. Reached from the link in the reset email, which
 * carries the single-use token as ?token=...
 */
const ResetPassword = () => {
  const { t } = useLanguage();
  const { confirmPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError(t('resetPassword.errors.required'));
      return;
    }

    if (password.length < 8) {
      setError(t('resetPassword.errors.tooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('resetPassword.errors.mismatch'));
      return;
    }

    try {
      setIsSubmitting(true);
      await confirmPasswordReset(token, password);
      setIsDone(true);
    } catch (err) {
      switch (err?.message) {
        case 'PASSWORD_TOO_SHORT':
          setError(t('resetPassword.errors.tooShort'));
          break;
        case 'TOO_MANY_ATTEMPTS':
          setError(t('login.errors.tooManyAttempts'));
          break;
        case 'NETWORK_ERROR':
          setError(t('register.errors.networkError'));
          break;
        default:
          setError(t('resetPassword.errors.invalidToken'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // A link without a token cannot be completed, so say so immediately.
  if (!token) {
    return (
      <div className="reset-password">
        <div className="reset-password-card">
          <h1>{t('resetPassword.title')}</h1>
          <div className="reset-password-error">{t('resetPassword.errors.missingToken')}</div>
          <Link to="/login" className="btn btn-secondary reset-password-back">
            {t('login.recovery.back')}
          </Link>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="reset-password">
        <div className="reset-password-card">
          <div className="reset-password-icon reset-password-icon-success">
            <CheckCircle size={28} />
          </div>
          <h1>{t('resetPassword.doneTitle')}</h1>
          <p className="reset-password-subtitle">{t('resetPassword.doneSubtitle')}</p>
          <button
            type="button"
            className="btn btn-primary reset-password-submit"
            onClick={() => navigate('/login', { replace: true })}
          >
            {t('login.recovery.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password">
      <div className="reset-password-card">
        <div className="reset-password-icon">
          <KeyRound size={28} />
        </div>
        <h1>{t('resetPassword.title')}</h1>
        <p className="reset-password-subtitle">{t('resetPassword.subtitle')}</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="reset-password-error">{error}</div>}

          <label className="reset-password-label" htmlFor="new-password">
            {t('resetPassword.newPassword')}
          </label>
          <div className="reset-password-field">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('resetPassword.newPasswordPlaceholder')}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="reset-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={t('resetPassword.togglePassword')}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label className="reset-password-label" htmlFor="confirm-password">
            {t('resetPassword.confirmPassword')}
          </label>
          <div className="reset-password-field">
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('resetPassword.confirmPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary reset-password-submit" disabled={isSubmitting}>
            {isSubmitting ? t('resetPassword.submitting') : t('resetPassword.submit')}
          </button>
        </form>

        <Link to="/login" className="reset-password-back-link">
          {t('login.recovery.back')}
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
