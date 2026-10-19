import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Palette, Moon, Sun, Save, RotateCcw, ArrowLeft, UserPlus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import './Settings.css';
import emailjs from '@emailjs/browser';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
  const { language, changeLanguage, t} = useLanguage();
const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
const [twoFactorEmail, setTwoFactorEmail] = useState('');
const [emailError, setEmailError] = useState("");


const [twoFactorSent, setTwoFactorSent] = useState(false);
const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      sms: false,
      surveys: true,
      news: true,
      chat: true
    },
    privacy: {
      showEmail: false,
      showPhone: false,
    },
    appearance: {
      theme: theme,
      language: language,
    },
    account: {
      twoFactor: false,
      sessionTimeout: 15,
      autoLogout: true
    }
  });

  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState('notifications');
  
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    // Show modal on mobile/tablet
    if (window.innerWidth <= 1024) {
      setShowSettingsModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowSettingsModal(false);
  };

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));

    if (category === 'appearance' && setting === 'language') {
      changeLanguage(value);
    }
  };

  const handleSave = () => {
    console.log('Settings saved:', settings);
    alert(t('settings.saveSuccess'));
  };

  const handleReset = () => {
    if (window.confirm(t('settings.resetConfirm'))) {
      setSettings({
        notifications: {
          email: true,
          push: true,
          sms: false,
          surveys: true,
          news: true,
          chat: true
        },
        privacy: {
          showEmail: false,
          showPhone: false,
        },
        appearance: {
          theme: 'light',
          language: 'am',
        },
        account: {
          twoFactor: false,
          sessionTimeout: 15,
          autoLogout: true
        }
      });
      changeLanguage('am');
    }
  };

  useEffect(() => {
    if (!settings.account.autoLogout) return;
    let timer;
    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        alert('You have been logged out due to inactivity.');
      }, (settings.account.sessionTimeout || 30) * 60 * 1000);
    };
    activityEvents.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [settings.account.autoLogout, settings.account.sessionTimeout, logout]);

  const tabs = [
    { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
    { id: 'privacy', label: t('tabs.privacy'), icon: Shield },
    { id: 'appearance', label: t('tabs.appearance'), icon: Palette },
    { id: 'account', label: t('tabs.account'), icon: SettingsIcon },
    { id: 'invite', label: 'Invite Friends', icon: UserPlus }
  ];
  const renderSettingsContent = () => (
    <div className="settings-panel">
              {activeTab === 'notifications' && (
                <div className="settings-section">
                  <h2>{t('notifications.title')}</h2>
                  <p className="section-description">{t('notifications.subtitle')}</p>

                  <div className="settings-group">
                    <h3>{t('notifications.methods')}</h3>
                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('notifications.email')}</label>
                        <p className="setting-description">{t('notifications.emailDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.email}
                          onChange={(e) => handleSettingChange('notifications', 'email', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('notifications.push')}</label>
                        <p className="setting-description">{t('notifications.pushDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.push}
                          onChange={(e) => handleSettingChange('notifications', 'push', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('notifications.sms')}</label>
                        <p className="setting-description">{t('notifications.smsDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.sms}
                          onChange={(e) => handleSettingChange('notifications', 'sms', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-group">
                    <h3>{t('notifications.types')}</h3>
                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('notifications.surveys')}</label>
                        <p className="setting-description">{t('notifications.surveysDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.surveys}
                          onChange={(e) => handleSettingChange('notifications', 'surveys', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('notifications.news')}</label>
                        <p className="setting-description">{t('notifications.newsDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.news}
                          onChange={(e) => handleSettingChange('notifications', 'news', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('notifications.chat')}</label>
                        <p className="setting-description">{t('notifications.chatDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications.chat}
                          onChange={(e) => handleSettingChange('notifications', 'chat', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="settings-section">
                  <h2>{t('privacy.title')}</h2>
                  <p className="section-description">{t('privacy.subtitle')}</p>

                  <div className="settings-group">

                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('privacy.showEmail')}</label>
                        <p className="setting-description">{t('privacy.showEmailDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.privacy.showEmail}
                          onChange={(e) => handleSettingChange('privacy', 'showEmail', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('privacy.showPhone')}</label>
                        <p className="setting-description">{t('privacy.showPhoneDesc')}</p>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.privacy.showPhone}
                          onChange={(e) => handleSettingChange('privacy', 'showPhone', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="settings-section">
                  <h2>{t('appearance.title')}</h2>
                  <p className="section-description">{t('appearance.subtitle')}</p>

                  <div className="settings-group">
                    <h3>{t('appearance.theme')}</h3>
                    <div className="theme-options">
                      <label className="theme-option">
                        <input
                          type="radio"
                          name="theme"
                          value="light"
                          checked={theme === 'light'}
                          onChange={() => {
                            if (theme !== 'light') toggleTheme();
                          }}
                        />
                        <div className="theme-preview light">
                          <Sun size={24} />
                          <span>{t('appearance.light')}</span>
                        </div>
                      </label>
                      <label className="theme-option">
                        <input
                          type="radio"
                          name="theme"
                          value="dark"
                          checked={theme === 'dark'}
                          onChange={() => {
                            if (theme !== 'dark') toggleTheme();
                          }}
                        />
                        <div className="theme-preview dark">
                          <Moon size={24} />
                          <span>{t('appearance.dark')}</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="settings-group">
                    <h3>{t('appearance.language')}</h3>
                    <div className="setting-item">
                      <div className="setting-info">
                        <label className="setting-label">{t('appearance.languageLabel')}</label>
                        <p className="setting-description">{t('appearance.languageDesc')}</p>
                      </div>
                      <select
                        value={settings.appearance.language}
                        onChange={(e) => handleSettingChange('appearance', 'language', e.target.value)}
                        className="setting-select"
                      >
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                        <option value="am">Հայերեն</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

             {activeTab === 'account' && (
  <div className="settings-section">
    <h2>{t('account.title')}</h2>
    <p className="section-description">{t('account.subtitle')}</p>

    <div className="settings-group">
      <h3>{t('account.security')}</h3>
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">{t('account.twoFactor')}</label>
          <p className="setting-description">{t('account.twoFactorDesc')}</p>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.account.twoFactor}
            onChange={(e) => {
              handleSettingChange('account', 'twoFactor', e.target.checked);
              setShowTwoFactorModal(e.target.checked);
              setTwoFactorSent(false);
            }}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {/* INLINE FORM */}
      {showTwoFactorModal && (
        <div className="twofactor-inline-form">

          {!twoFactorSent ? (
            <>
              <input className='enterTwoEmail'
                type="email"
                placeholder={t('settings.enterEmail')}
                value={twoFactorEmail}
                onChange={(e) => {
                  setTwoFactorEmail(e.target.value);
                  setEmailError("");
                }}
              />

              {/* Error message */}
              {emailError && (
                <p style={{ color: "red", marginTop: 5 }}>
                  {emailError}
                </p>
              )}

              <button
                className='send-button'
                onClick={() => {
                  if (twoFactorEmail.trim() !== user.email.trim()) {
                    setEmailError(t('settings.notMatch'));
                    return;
                  }
                 const code = Math.floor(1000 + Math.random() * 9000);
    
                  const templateParams = {
                    to_email: twoFactorEmail,
                    message: `Your 2FA code is: ${code}`,
                  };

                  emailjs
                    .send(
                      "service_bzm077b",
                      "template_gomqa6h",
                      templateParams,
                      "cdiLKm1nFLt0BfCH5"
                    )
                    .then(() => {
                      setTwoFactorSent(true);

                      setTimeout(() => {
                        setShowTwoFactorModal(false);
                        setTwoFactorEmail('');
                        setTwoFactorSent(false);
                      }, 2000);
                    })
                    .catch((err) => {
                      setEmailError(t('registration.errors.failedSend'));
                    });
                }}
              >
                {t('settings.sendCode')}
              </button>
            </>
          ) : (
            <p className="twofactor-success">
              {t('settings.codeSend') }
            </p>
          )}
        </div>
      )}

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">{t('account.sessionTimeout')}</label>
          <p className="setting-description">{t('account.sessionTimeoutDesc')}</p>
        </div>
        <select
          value={settings.account.sessionTimeout}
          onChange={(e) => handleSettingChange('account', 'sessionTimeout', parseInt(e.target.value))}
          className="setting-select"
        >
          <option value={15}>{t('account.minutes15')}</option>
          <option value={30}>{t('account.minutes30')}</option>
          <option value={60}>{t('account.hour1')}</option>
          <option value={120}>{t('account.hours2')}</option>
        </select>
      </div>

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">{t('account.autoLogout')}</label>
          <p className="setting-description">{t('account.autoLogoutDesc')}</p>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.account.autoLogout}
            onChange={(e) => handleSettingChange('account', 'autoLogout', e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    </div>
  </div>
)}

              {activeTab === 'invite' && (
                <div className="settings-section">
                  <h2>Invite Friends</h2>
                  <p className="section-description">Share your referral code or QR code with friends to invite them to join.</p>

                  <div className="settings-group">
                    <div className="invite-section">
                      <div className="qr-code-container">
                        <h3>Scan to Join</h3>
                        <div className="qr-code-wrapper">
                          <img 
                            src="/logo/qr-code.png" 
                            alt="QR Code" 
                            className="qr-code-image"
                          />
                        </div>
                        <p className="qr-code-description">
                          Ask your friends to scan this QR code to join the platform
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {activeTab !== 'invite' && (
                <div className="settings-actions">
                  <button onClick={handleReset} className="btn btn-secondary">
                    <RotateCcw size={16} />
                    {t('settings.reset')}
                  </button>
                  <button onClick={handleSave} className="btn btn-primary">
                    <Save size={16} />
                    {t('settings.save')}
                  </button>
                </div>
              )}
    </div>
  );

  return (
    <div className="settings">
      <div className="container">
        <div className="page-header">
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>

        <div className="settings-content">
          {/* Settings Nav - Full screen on mobile/tablet */}
          <div className="settings-sidebar">
            <nav className="settings-nav">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab.id)}
                  >
                    <Icon size={20} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Desktop Settings Main - Always visible on desktop */}
          <div className="settings-main desktop-only">
            {renderSettingsContent()}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Settings Modal */}
      {showSettingsModal && (
        <div className="settings-modal-overlay" onClick={handleCloseModal}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <button className="back-btn" onClick={handleCloseModal}>
                <ArrowLeft size={20} />
              </button>
              <h2>{tabs.find(tab => tab.id === activeTab)?.label}</h2>
            </div>
            <div className="settings-modal-content">
              <div className="settings-main">
                {renderSettingsContent()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
