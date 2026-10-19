import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  ClipboardList,
  BellRing,
  Settings2,
  AlertTriangle,
  Info

} from 'lucide-react';
import './Admin.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

const Admin = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [adminStats, setAdminStats] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await apiFetch('/api/dashboard');
        if (!response.ok) {
          throw new Error('DASHBOARD_API_FAILED');
        }
        const data = await response.json();
        setAdminStats(data.stats);
      } catch (error) {
        console.warn('Unable to load admin stats', error);
      }
    };

    loadStats();
  }, []);

  const stats = [
    {
      label: t('adminPage.stats.totalUsers'),
      value: adminStats?.totalUsers ?? '—',
      trend: t('adminPage.stats.trendStable'),
      icon: Users
    },
    {
      label: t('adminPage.stats.activeSurveys'),
      value: adminStats?.activeSurveys ?? '—',
      trend: `${adminStats?.totalSurveys ?? 0} total`,
      icon: ClipboardList
    },
    {
      label: t('adminPage.stats.pendingApprovals'),
      value: adminStats?.completedSurveys ?? '0',
      trend: t('dashboard.stats.completed'),
      icon: ShieldCheck
    },
    {
      label: t('adminPage.stats.incidents'),
      value: adminStats?.totalResponses ?? '0',
      trend: t('dashboard.stats.totalResponses'),
      icon: AlertTriangle
    }
  ];

  const actions = [
    {
      id: 'broadcast',
      title: t('adminPage.quickActions.broadcast.title'),
      description: t('adminPage.quickActions.broadcast.description'),
      icon: BellRing
    },
    {
      id: 'roles',
      title: t('adminPage.quickActions.roles.title'),
      description: t('adminPage.quickActions.roles.description'),
      icon: Settings2
    },
    {
      id: 'pending',
      title: t('adminPage.quickActions.pending.title'),
      description: t('adminPage.quickActions.pending.description'),
      icon: ClipboardList
    },
  ];

  // The three roles are fixed in the code and enforced by the API, so this is a
  // reference list rather than something the console can edit.
  const roleTemplates = [
    {
      id: 'admin',
      name: t('adminPage.quickActions.roles.admin'),
      permissions: [
        t('adminPage.quickActions.roles.manageUsers'),
        t('adminPage.quickActions.roles.publish'),
        t('adminPage.quickActions.roles.viewResults'),
        t('adminPage.quickActions.roles.editSystem')
      ],
      color: '#ef4444'
    },
    {
      id: 'lecturer',
      name: t('adminPage.quickActions.roles.lecturer'),
      permissions: [
        t('adminPage.quickActions.roles.create'),
        t('adminPage.quickActions.roles.viewCourses'),
        t('adminPage.quickActions.roles.viewResults')
      ],
      color: '#f59e0b'
    },
    {
      id: 'student',
      name: t('adminPage.quickActions.roles.student'),
      permissions: [
        t('adminPage.quickActions.roles.takeSurveys'),
        t('adminPage.quickActions.roles.viewNews')
      ],
      color: '#10b981'
    }
  ];

  const UnavailableNotice = ({ children }) => (
    <p className="feature-unavailable">
      <Info size={18} />
      <span>{children}</span>
    </p>
  );

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div className="admin-hero-text">
          <p className="admin-hero-label">{t('adminPage.eyebrow')}</p>
          <h1>{t('adminPage.title')}</h1>
          <p>{t('adminPage.subtitle')}</p>
          <div className="admin-hero-meta">
            <div className="admin-meta-chip">
              {user?.roleLabel || t('adminPage.roleFallback')}
            </div>
            <div className="admin-meta-chip">{user?.email}</div>
          </div>
        </div>
        <div className="admin-hero-profile">
          {user?.avatar && (
            <img src={user.avatar} alt={user.firstName} className="admin-avatar" />
          )}
          <div>
            <div className="admin-hero-name">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="admin-hero-role">{t(`header.roleLabels.${user?.role}`)}</div>
            <div className="admin-hero-id">{user?.studentId || user?.dbId}</div>
          </div>
        </div>
      </section>

      <section className="admin-overview-grid">
        {stats.map(({ label, value, trend, icon: Icon }) => (
          <article key={label} className="admin-card">
            <div className="admin-card-icon">
              <Icon size={20} />
            </div>
            <div>
              <p className="admin-card-label">{label}</p>
              <p className="admin-card-value">{value}</p>
              <p className="admin-card-trend">{trend}</p>
            </div>
          </article>
        ))}
      </section>

      {!activeSection && (
        <div className="admin-console">
          <div className="admin-console-header">
            <h2>{t('adminPage.quickActionsTitle')}</h2>
            <p>{t('adminPage.quickActionsSubtitle')}</p>
          </div>
          <div className="admin-console-buttons">
            {actions.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="console-action-button"
                onClick={() => setActiveSection(id)}
              >
                <div className="console-button-icon">
                  <Icon size={24} />
                </div>
                <div className="console-button-text">
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSection && (
        <div className="admin-content-panel">
          <button
            type="button"
            className="content-panel-back"
            onClick={() => setActiveSection(null)}
          >
            ← {t('adminPage.back')}
          </button>

          {activeSection === 'broadcast' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.broadcast.broadcast')}</h2>
              <p>{t('adminPage.quickActions.broadcast.send')}</p>
              <UnavailableNotice>
                {t('adminPage.quickActions.broadcast.unavailable')}
              </UnavailableNotice>
              {/* Nothing delivers these messages, so the form is switched off and
                  the submit is swallowed rather than reloading the page. */}
              <form className="broadcast-form is-disabled" onSubmit={(event) => event.preventDefault()}>
                <fieldset disabled>
                  <div className="form-group">
                    <label>{t('adminPage.quickActions.broadcast.messageTitle')}</label>
                    <input type="text" placeholder={t('adminPage.quickActions.broadcast.enterTitle')} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>{t('adminPage.quickActions.broadcast.messageContent')}</label>
                    <textarea placeholder={t('adminPage.quickActions.broadcast.enterContent')} rows="6" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>{t('adminPage.quickActions.broadcast.target')}</label>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>{t('adminPage.quickActions.broadcast.allUsers')}</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>{t('adminPage.quickActions.broadcast.admins')}</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>{t('adminPage.quickActions.broadcast.lecturers')}</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>{t('adminPage.quickActions.broadcast.students')}</span>
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="submit-button">{t('adminPage.quickActions.broadcast.sendBroadcast')}</button>
                </fieldset>
              </form>
            </div>
          )}

          {activeSection === 'roles' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.roles.manage')}</h2>
              <p>{t('adminPage.quickActions.roles.configure')}</p>
              <UnavailableNotice>
                {t('adminPage.quickActions.roles.readOnly')}
              </UnavailableNotice>
              <div className="roles-grid">
                {roleTemplates.map((role) => (
                  <div key={role.id} className="role-card">
                    <h3 style={{ color: role.color }}>{role.name}</h3>
                    <div className="permissions-list">
                      {role.permissions.map((perm) => (
                        <span key={perm} className="permission-badge">{perm}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'pending' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.pending.pendingApprovals')}</h2>
              <p>{t('adminPage.quickActions.pending.desc')}</p>
              <UnavailableNotice>
                {t('adminPage.quickActions.pending.unavailable')}
              </UnavailableNotice>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Admin;
