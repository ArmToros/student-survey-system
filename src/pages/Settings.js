import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Palette, Moon, Sun, Save, RotateCcw, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import './Settings.css';
import { apiFetch } from '../services/api';
import PageHero from '../components/PageHero';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
  const { language, changeLanguage, t} = useLanguage();


const [showSettingsModal, setShowSettingsModal] = useState(false);
const [saveState, setSaveState] = useState(null);
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      surveys: true,
      news: true,
      chat: true
    },
    privacy: {
      showEmail: false,
    },
    appearance: {
      theme: theme,
      language: language,
    },
    account: {
      sessionTimeout: 15,
      autoLogout: true
    }
  });


  const [activeTab, setActiveTab] = useState('notifications');

  // Notifications, privacy and account switches live in UserAccount.Preferences
  // as JSON; theme and language have their own columns and are applied by their
  // own contexts. Anything absent keeps the default set above, so an account
  // that has never saved still gets a sensible page.
  useEffect(() => {
    if (!user?.dbId) {
      return;
    }

    let cancelled = false;

    const loadPreferences = async () => {
      try {
        const response = await apiFetch(`/api/users/${user.dbId}`);
        if (!response.ok) {
          throw new Error('PREFERENCES_FAILED');
        }

        const data = await response.json();
        if (cancelled || !data?.preferences) {
          return;
        }

        setSettings(prev => ({
          ...prev,
          notifications: { ...prev.notifications, ...(data.preferences.notifications || {}) },
          privacy: { ...prev.privacy, ...(data.preferences.privacy || {}) },
          account: { ...prev.account, ...(data.preferences.account || {}) }
        }));
      } catch (error) {
        console.warn('Unable to load saved settings', error);
      }
    };

    loadPreferences();
    return () => { cancelled = true; };
  }, [user?.dbId]);
  
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

  const handleSave = async () => {
    if (!user?.dbId) {
      return;
    }

    setSaveState('saving');
    try {
      const response = await apiFetch(`/api/users/${user.dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Theme and language are stored in their own columns.
          theme: settings.appearance.theme,
          language: settings.appearance.language,
          preferences: {
            notifications: settings.notifications,
            privacy: settings.privacy,
            account: settings.account
          }
        })
      });

      if (!response.ok) {
        throw new Error('SAVE_FAILED');
      }

      setSaveState('saved');
      setTimeout(() => setSaveState(current => (current === 'saved' ? null : current)), 2500);
    } catch (error) {
      console.error(error);
      setSaveState('error');
    }
  };

  const handleReset = () => {
    if (window.confirm(t('settings.resetConfirm'))) {
      setSettings({
        notifications: {
          email: true,
          push: true,
          surveys: true,
          news: true,
          chat: true
        },
        privacy: {
          showEmail: false,
        },
        appearance: {
          theme: 'light',
          language: 'am',
        },
        account: {
          sessionTimeout: 15,
          autoLogout: true
        }
      });
      changeLanguage('am');
    }
  };



  const tabs = [
    { id: 'appearance', label: t('tabs.appearance'), icon: Palette },
    { id: 'account', label: t('tabs.account'), icon: SettingsIcon }
  ];
  const renderSettingsContent = () => (
    <div className="settings-panel">
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

              <div className="settings-actions">
                  <button onClick={handleReset} className="btn btn-secondary">
                    <RotateCcw size={16} />
                    {t('settings.reset')}
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    disabled={saveState === 'saving'}
                  >
                    <Save size={16} />
                    {saveState === 'saving' ? t('settings.saving') : t('settings.save')}
                  </button>
                  {saveState === 'saved' && (
                    <span className="settings-saved">{t('settings.saveSuccess')}</span>
                  )}
                  {saveState === 'error' && (
                    <span className="settings-save-error">{t('settings.saveFailed')}</span>
                  )}
                </div>
    </div>
  );

  return (
    <div className="settings">
      <div className="container">
        <PageHero
          eyebrow={t('settings.eyebrow')}
          title={t('settings.title')}
          subtitle={t('settings.subtitle')}
        />

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
