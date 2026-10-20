import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  ClipboardList,
  BellRing,
  Settings2,
  AlertTriangle,
  Info,
  HelpCircle,
  UserCog,
  Newspaper,
  Pencil,
  Trash2

} from 'lucide-react';
import './Admin.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

const Admin = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(null);

  // The preset questions shown on the support page, with their ready-made
  // answers. Admins own this list; everyone else only reads it.
  const [presets, setPresets] = useState([]);
  const [presetForm, setPresetForm] = useState({ question: '', answer: '' });
  const [editingPreset, setEditingPreset] = useState(null);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetError, setPresetError] = useState(null);
  const [botName, setBotName] = useState('');
  const [botSaved, setBotSaved] = useState(false);

  // Accounts. Only admins reach this, and only here can a profile be changed.
  const BLANK_USER = {
    firstName: '', lastName: '', email: '', phone: '', address: '',
    role: 'Student', major: '', degree: 'Bachelor', startYear: '', department: '', password: ''
  };
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(BLANK_USER);
  const [editingUser, setEditingUser] = useState(null);
  const [userBusy, setUserBusy] = useState(false);
  const [userError, setUserError] = useState(null);

  // News. Admins write it; the audience decides who sees it.
  const BLANK_ARTICLE = { title: '', content: '', newsTypeId: '', audience: [] };
  const [articles, setArticles] = useState([]);
  const [newsTypes, setNewsTypes] = useState([]);
  const [articleForm, setArticleForm] = useState(BLANK_ARTICLE);
  const [editingArticle, setEditingArticle] = useState(null);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState(null);
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
      id: 'news',
      title: t('adminPage.quickActions.news.title'),
      description: t('adminPage.quickActions.news.description'),
      icon: Newspaper
    },
    {
      id: 'users',
      title: t('adminPage.quickActions.users.title'),
      description: t('adminPage.quickActions.users.description'),
      icon: UserCog
    },
    {
      id: 'support',
      title: t('adminPage.quickActions.support.title'),
      description: t('adminPage.quickActions.support.description'),
      icon: HelpCircle
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

  const loadNews = async () => {
    try {
      const [itemsResponse, typesResponse] = await Promise.all([
        // Admins author for every audience, so the list is unfiltered here.
        apiFetch('/api/news'),
        apiFetch('/api/news/types')
      ]);

      if (!itemsResponse.ok || !typesResponse.ok) {
        throw new Error('NEWS_FAILED');
      }

      setArticles(await itemsResponse.json());
      setNewsTypes(await typesResponse.json());
      setNewsError(null);
    } catch (error) {
      console.warn('Unable to load news', error);
      setNewsError(t('adminPage.quickActions.news.loadFailed'));
    }
  };

  const saveArticle = async () => {
    if (!articleForm.title.trim() || !articleForm.content.trim()) {
      return;
    }

    setNewsBusy(true);
    setNewsError(null);
    try {
      const response = await apiFetch(
        editingArticle ? `/api/news/${editingArticle}` : '/api/news',
        {
          method: editingArticle ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: articleForm.title,
            content: articleForm.content,
            newsTypeId: articleForm.newsTypeId ? Number(articleForm.newsTypeId) : null,
            audience: articleForm.audience
          })
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'SAVE_FAILED');
      }

      setArticleForm(BLANK_ARTICLE);
      setEditingArticle(null);
      await loadNews();
    } catch (error) {
      console.error(error);
      setNewsError(error.message === 'SAVE_FAILED'
        ? t('adminPage.quickActions.news.saveFailed')
        : error.message);
    } finally {
      setNewsBusy(false);
    }
  };

  const editArticle = (article) => {
    setEditingArticle(article.id);
    setArticleForm({
      title: article.title || '',
      content: article.content || '',
      newsTypeId: article.newsTypeId || '',
      audience: article.audience || []
    });
  };

  const deleteArticle = async (article) => {
    if (!window.confirm(t('adminPage.quickActions.news.deleteConfirm').replace('{title}', article.title))) {
      return;
    }

    setNewsBusy(true);
    setNewsError(null);
    try {
      const response = await apiFetch(`/api/news/${article.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('DELETE_FAILED');
      }
      await loadNews();
    } catch (error) {
      console.error(error);
      setNewsError(t('adminPage.quickActions.news.saveFailed'));
    } finally {
      setNewsBusy(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiFetch('/api/users');
      if (!response.ok) {
        throw new Error('USERS_FAILED');
      }
      setUsers(await response.json());
      setUserError(null);
    } catch (error) {
      console.warn('Unable to load accounts', error);
      setUserError(t('adminPage.quickActions.users.loadFailed'));
    }
  };

  const saveUser = async () => {
    setUserBusy(true);
    setUserError(null);
    try {
      const payload = { ...userForm };
      payload.startYear = payload.startYear === '' ? null : Number(payload.startYear);
      if (editingUser) {
        delete payload.password;
      }

      const response = await apiFetch(
        editingUser ? `/api/users/${editingUser}` : '/api/users',
        {
          method: editingUser ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'SAVE_FAILED');
      }

      setUserForm(BLANK_USER);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      console.error(error);
      setUserError(error.message === 'SAVE_FAILED'
        ? t('adminPage.quickActions.users.saveFailed')
        : error.message);
    } finally {
      setUserBusy(false);
    }
  };

  const editUser = (account) => {
    setEditingUser(account.dbId);
    setUserForm({
      firstName: account.firstName || '',
      lastName: account.lastName || '',
      email: account.email || '',
      phone: account.phone || '',
      address: account.address || '',
      role: account.role ? account.role.charAt(0).toUpperCase() + account.role.slice(1) : 'Student',
      major: account.major || '',
      degree: account.degree || 'Bachelor',
      startYear: account.startYear || '',
      department: account.department || '',
      password: ''
    });
  };

  const deleteUser = async (account) => {
    if (!window.confirm(t('adminPage.quickActions.users.deleteConfirm').replace('{name}', `${account.firstName} ${account.lastName}`))) {
      return;
    }

    setUserBusy(true);
    setUserError(null);
    try {
      const response = await apiFetch(`/api/users/${account.dbId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'DELETE_FAILED');
      }
      await loadUsers();
    } catch (error) {
      console.error(error);
      setUserError(error.message === 'DELETE_FAILED'
        ? t('adminPage.quickActions.users.saveFailed')
        : error.message);
    } finally {
      setUserBusy(false);
    }
  };

  const loadBotName = async () => {
    try {
      const response = await apiFetch('/api/support/bot');
      if (!response.ok) {
        throw new Error('BOT_FAILED');
      }
      const data = await response.json();
      setBotName(data?.name || '');
    } catch (error) {
      console.warn('Unable to load the bot name', error);
    }
  };

  const saveBotName = async () => {
    if (!botName.trim()) {
      return;
    }

    setPresetBusy(true);
    try {
      const response = await apiFetch('/api/support/bot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: botName })
      });
      if (!response.ok) {
        throw new Error('BOT_SAVE_FAILED');
      }
      setBotSaved(true);
      setTimeout(() => setBotSaved(false), 2500);
    } catch (error) {
      console.error(error);
      setPresetError(t('adminPage.quickActions.support.saveFailed'));
    } finally {
      setPresetBusy(false);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await apiFetch('/api/support/questions');
      if (!response.ok) {
        throw new Error('PRESETS_FAILED');
      }
      setPresets(await response.json());
      setPresetError(null);
    } catch (error) {
      console.warn('Unable to load preset questions', error);
      setPresetError(t('adminPage.quickActions.support.loadFailed'));
    }
  };

  useEffect(() => {
    if (activeSection === 'support') {
      loadPresets();
      loadBotName();
    }

    if (activeSection === 'users') {
      loadUsers();
    }

    if (activeSection === 'news') {
      loadNews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const savePreset = async () => {
    if (!presetForm.question.trim() || !presetForm.answer.trim()) {
      return;
    }

    setPresetBusy(true);
    try {
      const response = await apiFetch(
        editingPreset ? `/api/support/questions/${editingPreset}` : '/api/support/questions',
        {
          method: editingPreset ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(presetForm)
        }
      );

      if (!response.ok) {
        throw new Error('SAVE_FAILED');
      }

      setPresetForm({ question: '', answer: '' });
      setEditingPreset(null);
      await loadPresets();
    } catch (error) {
      console.error(error);
      setPresetError(t('adminPage.quickActions.support.saveFailed'));
    } finally {
      setPresetBusy(false);
    }
  };

  const togglePresetActive = async (preset) => {
    setPresetBusy(true);
    try {
      const response = await apiFetch(`/api/support/questions/${preset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !preset.isActive })
      });
      if (!response.ok) {
        throw new Error('TOGGLE_FAILED');
      }
      await loadPresets();
    } catch (error) {
      console.error(error);
      setPresetError(t('adminPage.quickActions.support.saveFailed'));
    } finally {
      setPresetBusy(false);
    }
  };

  const deletePreset = async (preset) => {
    if (!window.confirm(t('adminPage.quickActions.support.deleteConfirm'))) {
      return;
    }

    setPresetBusy(true);
    try {
      const response = await apiFetch(`/api/support/questions/${preset.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('DELETE_FAILED');
      }
      await loadPresets();
    } catch (error) {
      console.error(error);
      setPresetError(t('adminPage.quickActions.support.saveFailed'));
    } finally {
      setPresetBusy(false);
    }
  };

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

          {activeSection === 'news' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.news.heading')}</h2>
              <p>{t('adminPage.quickActions.news.desc')}</p>

              {newsError && <p className="preset-error">{newsError}</p>}

              <div className="preset-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('adminPage.quickActions.news.titlePlaceholder')}
                  value={articleForm.title}
                  onChange={(event) => setArticleForm({ ...articleForm, title: event.target.value })}
                />
                <textarea
                  rows="6"
                  className="form-input"
                  placeholder={t('adminPage.quickActions.news.bodyPlaceholder')}
                  value={articleForm.content}
                  onChange={(event) => setArticleForm({ ...articleForm, content: event.target.value })}
                />

                <select
                  className="form-input"
                  value={articleForm.newsTypeId}
                  onChange={(event) => setArticleForm({ ...articleForm, newsTypeId: event.target.value })}
                >
                  <option value="">{t('adminPage.quickActions.news.chooseCategory')}</option>
                  {newsTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>

                <div>
                  <label className="audience-label">{t('adminPage.quickActions.news.audience')}</label>
                  <p className="form-hint">{t('adminPage.quickActions.news.audienceHint')}</p>
                  <div className="audience-options">
                    {['Student', 'Lecturer', 'Admin'].map(role => (
                      <label key={role} className="audience-option">
                        <input
                          type="checkbox"
                          checked={articleForm.audience.includes(role)}
                          onChange={(event) => setArticleForm({
                            ...articleForm,
                            audience: event.target.checked
                              ? [...articleForm.audience, role]
                              : articleForm.audience.filter(item => item !== role)
                          })}
                        />
                        <span>{t(`header.roleLabels.${role.toLowerCase()}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="preset-form-actions">
                  <button
                    className="submit-button"
                    onClick={saveArticle}
                    disabled={newsBusy || !articleForm.title.trim() || !articleForm.content.trim()}
                  >
                    {editingArticle
                      ? t('adminPage.quickActions.news.saveChanges')
                      : t('adminPage.quickActions.news.publish')}
                  </button>
                  {editingArticle && (
                    <button
                      className="submit-button secondary"
                      onClick={() => { setEditingArticle(null); setArticleForm(BLANK_ARTICLE); }}
                    >
                      {t('adminPage.quickActions.support.cancel')}
                    </button>
                  )}
                </div>
              </div>

              <ul className="preset-list">
                {articles.map(article => (
                  <li key={article.id} className="preset-row">
                    <div className="preset-row-text">
                      <strong>{article.title}</strong>
                      <span>
                        {article.category}
                        {' · '}
                        {article.audience && article.audience.length > 0
                          ? article.audience.join(', ')
                          : t('adminPage.quickActions.news.everyone')}
                      </span>
                    </div>
                    <div className="preset-row-actions">
                      <button onClick={() => editArticle(article)} title={t('adminPage.quickActions.support.edit')}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => deleteArticle(article)} disabled={newsBusy}
                        title={t('adminPage.quickActions.news.delete')}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.users.heading')}</h2>
              <p>{t('adminPage.quickActions.users.desc')}</p>

              {userError && <p className="preset-error">{userError}</p>}

              <div className="user-form">
                <input className="form-input" placeholder={t('adminPage.quickActions.users.firstName')}
                  value={userForm.firstName}
                  onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
                <input className="form-input" placeholder={t('adminPage.quickActions.users.lastName')}
                  value={userForm.lastName}
                  onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
                <input className="form-input" type="email" placeholder={t('adminPage.quickActions.users.email')}
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                <input className="form-input" placeholder={t('adminPage.quickActions.users.phone')}
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />

                <select className="form-input" value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="Student">{t('header.roleLabels.student')}</option>
                  <option value="Lecturer">{t('header.roleLabels.lecturer')}</option>
                  <option value="Admin">{t('header.roleLabels.admin')}</option>
                </select>

                {userForm.role === 'Student' && (
                  <>
                    <input className="form-input" placeholder={t('adminPage.quickActions.users.major')}
                      value={userForm.major}
                      onChange={(e) => setUserForm({ ...userForm, major: e.target.value })} />
                    <select className="form-input" value={userForm.degree}
                      onChange={(e) => setUserForm({ ...userForm, degree: e.target.value })}>
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="PhD">PhD</option>
                    </select>
                    <input className="form-input" type="number" min="1900" max="2100"
                      placeholder={t('adminPage.quickActions.users.startYear')}
                      value={userForm.startYear}
                      onChange={(e) => setUserForm({ ...userForm, startYear: e.target.value })} />
                  </>
                )}

                {userForm.role === 'Lecturer' && (
                  <input className="form-input" placeholder={t('adminPage.quickActions.users.department')}
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} />
                )}

                {!editingUser && (
                  <input className="form-input" type="password"
                    placeholder={t('adminPage.quickActions.users.password')}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                )}
              </div>

              <p className="bot-name-hint">{t('adminPage.quickActions.users.yearHint')}</p>

              <div className="preset-form-actions">
                <button className="submit-button" onClick={saveUser} disabled={userBusy}>
                  {editingUser
                    ? t('adminPage.quickActions.users.saveChanges')
                    : t('adminPage.quickActions.users.addUser')}
                </button>
                {editingUser && (
                  <button className="submit-button secondary"
                    onClick={() => { setEditingUser(null); setUserForm(BLANK_USER); }}>
                    {t('adminPage.quickActions.support.cancel')}
                  </button>
                )}
              </div>

              <ul className="preset-list user-list">
                {users.map(account => (
                  <li key={account.dbId} className="preset-row">
                    <div className="preset-row-text">
                      <strong>{account.firstName} {account.lastName}</strong>
                      <span>
                        {account.email} &middot; {account.roleLabel}
                        {account.major ? ` · ${account.major}` : ''}
                        {account.degree ? ` · ${account.degree}` : ''}
                        {account.academicYear ? ` · ${t('accountPage.year')} ${account.academicYear}` : ''}
                        {account.department ? ` · ${account.department}` : ''}
                      </span>
                    </div>
                    <div className="preset-row-actions">
                      <button onClick={() => editUser(account)} title={t('adminPage.quickActions.support.edit')}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => deleteUser(account)} disabled={userBusy}
                        title={t('adminPage.quickActions.users.delete')}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeSection === 'support' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.support.heading')}</h2>
              <p>{t('adminPage.quickActions.support.desc')}</p>

              {presetError && <p className="preset-error">{presetError}</p>}

              <div className="bot-name-row">
                <label htmlFor="bot-name">{t('adminPage.quickActions.support.botName')}</label>
                <input
                  id="bot-name"
                  type="text"
                  className="form-input"
                  value={botName}
                  onChange={(event) => setBotName(event.target.value)}
                />
                <button
                  className="submit-button"
                  onClick={saveBotName}
                  disabled={presetBusy || !botName.trim()}
                >
                  {t('adminPage.quickActions.support.saveChanges')}
                </button>
                {botSaved && <span className="bot-name-saved">{t('settings.saveSuccess')}</span>}
              </div>
              <p className="bot-name-hint">{t('adminPage.quickActions.support.botNameHint')}</p>

              <div className="preset-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('adminPage.quickActions.support.questionPlaceholder')}
                  value={presetForm.question}
                  onChange={(event) => setPresetForm({ ...presetForm, question: event.target.value })}
                />
                <textarea
                  rows="4"
                  className="form-input"
                  placeholder={t('adminPage.quickActions.support.answerPlaceholder')}
                  value={presetForm.answer}
                  onChange={(event) => setPresetForm({ ...presetForm, answer: event.target.value })}
                />
                <div className="preset-form-actions">
                  <button
                    className="submit-button"
                    onClick={savePreset}
                    disabled={presetBusy || !presetForm.question.trim() || !presetForm.answer.trim()}
                  >
                    {editingPreset
                      ? t('adminPage.quickActions.support.saveChanges')
                      : t('adminPage.quickActions.support.addQuestion')}
                  </button>
                  {editingPreset && (
                    <button
                      className="submit-button secondary"
                      onClick={() => {
                        setEditingPreset(null);
                        setPresetForm({ question: '', answer: '' });
                      }}
                    >
                      {t('adminPage.quickActions.support.cancel')}
                    </button>
                  )}
                </div>
              </div>

              <ul className="preset-list">
                {presets.map(preset => (
                  <li key={preset.id} className={`preset-row ${preset.isActive ? '' : 'retired'}`}>
                    <div className="preset-row-text">
                      <strong>{preset.question}</strong>
                      <span>{preset.answer}</span>
                    </div>
                    <div className="preset-row-actions">
                      <button
                        onClick={() => {
                          setEditingPreset(preset.id);
                          setPresetForm({ question: preset.question, answer: preset.answer });
                        }}
                        title={t('adminPage.quickActions.support.edit')}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => togglePresetActive(preset)}
                        disabled={presetBusy}
                      >
                        {preset.isActive
                          ? t('adminPage.quickActions.support.retire')
                          : t('adminPage.quickActions.support.restore')}
                      </button>
                      <button
                        onClick={() => deletePreset(preset)}
                        disabled={presetBusy}
                        title={t('adminPage.quickActions.support.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
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
