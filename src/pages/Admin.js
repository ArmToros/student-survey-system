import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  ClipboardList,
  BellRing,
  Settings2,
  AlertTriangle,

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

  const permissions = user?.permissions || [];

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
      icon: BellRing,
      content: {
        title: 'Broadcast Message',
        description: 'Send notifications to all users or specific groups',
        form: true
      }
    },
    {
      id: 'roles',
      title: t('adminPage.quickActions.roles.title'),
      description: t('adminPage.quickActions.roles.description'),
      icon: Settings2,
      content: {
        title: t('adminPage.quickActions.roles.title'),
        description: t('adminPage.quickActions.roles.description'),
        roles: [
          { name: t('adminPage.quickActions.roles.admin'), permissions: [t('adminPage.quickActions.roles.manageUsers'), t('adminPage.quickActions.roles.publish'), t('adminPage.quickActions.roles.viewResults'), t('adminPage.quickActions.roles.editSystem')], color: '#ef4444' },
          { name: t('adminPage.quickActions.roles.lecturer'), permissions: [t('adminPage.quickActions.roles.create'), t('adminPage.quickActions.roles.viewCourses'), t('adminPage.quickActions.roles.viewResults')], color: '#f59e0b' },
          { name: t('adminPage.quickActions.roles.student'), permissions: [t('adminPage.quickActions.roles.takeSurveys'), t('adminPage.quickActions.roles.viewNews')], color: '#10b981' }
        ]
      }
    },
    {
      id: 'pending',
      title: t('adminPage.quickActions.pending.title'),
      description: t('adminPage.quickActions.pending.description'),
      icon: ClipboardList,
      content: {
        title: t('adminPage.quickActions.pending.title'),
        description:  t('adminPage.quickActions.approvals.description'),
        items: [
          { id: 1, type: 'Survey', name: 'Student Feedback Q4', submitted: '2024-11-27', submitter: 'lecturer@sss.edu' },
          { id: 2, type: 'User', name: 'New Student Registration', submitted: '2024-11-26', submitter: 'system' },
          { id: 3, type: 'Content', name: 'Course Material Upload', submitted: '2024-11-25', submitter: 'lecturer@sss.edu' },
          { id: 4, type: 'Report', name: 'Monthly Analytics', submitted: '2024-11-24', submitter: 'system' }
        ]
      }
    },
  ];

   const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '', permissions: [] });
  const [roles, setRoles] = useState(
    (actions.find(a => a.id === 'roles')?.content?.roles || []).map((role, idx) => ({
      ...role,
      id: idx + 1
    }))
  );
  // Example permission list (should be enhanced to fit your actual permissions model):
  const permissionOptions = [
    { id: 'manageUsers', name: t('adminPage.quickActions.roles.manageUsers') },
    { id: 'publishSurveys', name: t('adminPage.quickActions.roles.publish') },
    { id: 'viewResults', name: t('adminPage.quickActions.roles.viewResults')},
    { id: 'moderateChat', name: t('adminPage.quickActions.roles.moderateChat') },
    { id: 'editSystem', name: t('adminPage.quickActions.roles.editSystem') },
    { id: 'createSurveys', name: t('adminPage.quickActions.roles.create')},
    { id: 'gradeAssignments', name: t('adminPage.quickActions.roles.gradeAssignments') },
    { id: 'viewCourses', name: t('adminPage.quickActions.roles.viewCourses')},
    { id: 'takeSurveys', name: t('adminPage.quickActions.roles.takeSurveys') },
    { id: 'viewNews', name: t('adminPage.quickActions.roles.viewNews')},
  ];

  const [pendingItems, setPendingItems] = useState(
    (actions.find(i => i.id === 'pending')?.content?.items || [])
  );

  const handleEditRole = (role) => {
    setEditingRole(role);
    setFormData({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions
    });
    setShowEditModal(true);
  };

  const handleSaveRole = () => {
    if (!formData.name.trim()) {
      alert('Role name is required');
      return;
    }
    setRoles(roles.map(role =>
      role.id === formData.id
        ? {
            ...role,
            name: formData.name,
            description: formData.description,
            permissions: formData.permissions
          }
        : role
    ));
    setShowEditModal(false);
    setEditingRole(null);
    alert(t('adminPage.quickActions.roles.update'));
  };

  const handlePermissionToggle = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const handleDeleteRole = (roleId) => {
    if (window.confirm(t('adminPage.quickActions.roles.areSure'))) {
      setRoles(roles.filter(role => role.id !== roleId));
    }
  };
       
  // Handler for approving
  const handleApprovePendingItem = (id) => {
    setPendingItems(items => items.filter(item => item.id !== id));
  };
   
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
              <form className="broadcast-form">
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
              </form>
            </div>
          )}

           {activeSection === 'roles' && (
            <div className="content-section">
              <h2>{t('adminPage.quickActions.roles.manage')}</h2>
              <p>{t('adminPage.quickActions.roles.configure')}</p>
              <div className="roles-grid">
                {roles.map((role, idx) => (
                  <div key={role.id || idx} className="role-card">
                    <h3 style={{ color: role.color }}>{role.name}</h3>
                    <div className="permissions-list">
                      {role.permissions.map((perm) => (
                        <span key={perm} className="permission-badge">{perm}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={() => handleEditRole(role)}>{t('adminPage.quickActions.roles.edit')}</button>
                      <button className="btn btn-danger" onClick={() => handleDeleteRole(role.id)}>{t('adminPage.quickActions.roles.delete')}</button>
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
              <div className="pending-list">
                {pendingItems.map((item) => (
                  <div key={item.id} className="pending-item">
                    <div className="pending-type">{item.type}</div>
                    <div className="pending-details">
                      <h4>{item.name}</h4>
                      <p>{t('adminPage.quickActions.pending.submitted')} {item.submitted} {t('adminPage.quickActions.pending.by')} {item.submitter}</p>
                    </div>
                    <button className="approve-button" onClick={() => handleApprovePendingItem(item.id)}>{t('adminPage.quickActions.pending.approve')}</button>
                    <button className="approve-button" onClick={() => handleApprovePendingItem(item.id)}>{t('adminPage.quickActions.pending.reject')}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-body">
              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-list">
                  {permissionOptions.map(permission => (
                    <div key={permission.id} className="permission-item">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={formData.permissions.includes(permission.id)} onChange={() => handlePermissionToggle(permission.id)} />
                        <span className="permission-name">{permission.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>{t('adminPage.quickActions.roles.cancel')}</button>
              <button className="btn btn-primary" onClick={editingRole ? handleSaveRole : handleAddNewRole}> {t('adminPage.quickActions.roles.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
