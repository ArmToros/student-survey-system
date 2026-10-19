import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Edit3, Save, X, Camera } from 'lucide-react';
import './Account.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';


const Account = () => {
  const {  t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const { user, updateUser } = useAuth();
  const [userData, setUserData] = useState(user);
  const [editData, setEditData] = useState({ ...userData });
  const displayId = userData?.studentId || userData?.dbId || userData?.id?.split('-').pop() || '—';

  useEffect(() => {
    setUserData(user);
    setEditData({ ...user });
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({ ...userData });
  };

  const handleSave = async () => {
    try {
      const response = await apiFetch(`/api/users/${userData.dbId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      });

      if (!response.ok) {
        throw new Error('UPDATE_USER_FAILED');
      }

      const savedUser = await response.json();
      setUserData(savedUser);
      updateUser(savedUser);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert('Could not save profile changes to the database.');
    }
  };

  const handleCancel = () => {
    setEditData({ ...userData });
    setIsEditing(false);
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="account">
      <div className="container">
        <div className="page-header">
          <h1>{t('accountPage.title')}</h1>
          <p>{t('accountPage.subtitle')}</p>
        </div>

        <div className="account-content">
          <div className="profile-section">
            <div className="profile-card">
              <div className="profile-header">
                <div className="avatar-container">
                  {userData?.avatar ? (
                    <img src={userData.avatar} alt="Profile" className="profile-avatar" />
                  ) : (
                    <div className="profile-avatar">
                      <User size={40} />
                    </div>
                  )}
                  <button className="avatar-edit-btn">
                    <Camera size={16} />
                  </button>
                </div>
                <div className="profile-info">
                  <h2>{userData?.firstName} {userData?.lastName}</h2>
                  <p className="profile-email">{userData?.email}</p>
                  <p className="profile-role">{userData?.roleLabel}</p>
                </div>
                <div className="profile-actions">
                  {!isEditing ? (
                    <button onClick={handleEdit} className="btn btn-outline">
                      <Edit3 size={16} />
                      {t('accountPage.editProfile')}
                    </button>
                  ) : (
                    <div className="edit-actions">
                      <button onClick={handleSave} className="btn btn-primary">
                        <Save size={16} />
                        {t('accountPage.save')}
                      </button>
                      <button onClick={handleCancel} className="btn btn-secondary">
                        <X size={16} />
                        {t('accountPage.cancel')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-details">
                <div className="details-grid">
                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                     {t('accountPage.firstName')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.firstName || ''}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="detail-input"
                      />
                    ) : (
                      <span className="detail-value">{userData?.firstName}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                     {t('accountPage.lastName')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.lastName || ''}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="detail-input"
                      />
                    ) : (
                      <span className="detail-value">{userData?.lastName}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <Mail size={18} />
                     {t('accountPage.email')}
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="detail-input"
                      />
                    ) : (
                      <span className="detail-value">{userData?.email}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <Phone size={18} />
                      {t('accountPage.phone')}
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editData.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="detail-input"
                      />
                    ) : (
                      <span className="detail-value">{userData?.phone || '—'}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                      {t('accountPage.studentId')}
                    </label>
                    <span className="detail-value">{displayId}</span>
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                      {t('accountPage.major')}
                    </label>
                    {isEditing ? (
                      <select
                        value={editData.major || ''}
                        onChange={(e) => handleInputChange('major', e.target.value)}
                        className="detail-input"
                      >
                        <option value="Computer Science">{t('accountPage.majors.cs')}</option>
                        <option value="Engineering">{t('accountPage.majors.engineering')}</option>
                        <option value="Business">{t('accountPage.majors.business')}</option>
                        <option value="Medicine">{t('accountPage.majors.medicine')}</option>
                        <option value="Arts">{t('accountPage.majors.arts')}</option>
                      </select>
                    ) : (
                      <span className="detail-value">{userData?.major || '—'}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                      {t('accountPage.academicYear')}
                    </label>
                    {isEditing ? (
                      <select
                        value={editData.year || ''}
                        onChange={(e) => handleInputChange('year', e.target.value)}
                        className="detail-input"
                      >
                        <option value="Freshman">{t('accountPage.years.freshman')}</option>
                        <option value="Sophomore">{t('accountPage.years.sophomore')}</option>
                        <option value="Junior">{t('accountPage.years.junior')}</option>
                        <option value="Senior">{t('accountPage.years.senior')}</option>
                        <option value="Graduate">{t('accountPage.years.graduate')}</option>
                      </select>
                    ) : (
                      <span className="detail-value">{userData?.year || '—'}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <MapPin size={18} />
                      {t('accountPage.address')}
                    </label>
                    {isEditing ? (
                      <textarea
                        value={editData.address || ''}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className="detail-input"
                        rows="2"
                      />
                    ) : (
                      <span className="detail-value">{userData?.address || '—'}</span>
                    )}
                  </div>

                  <div className="detail-item">
                    <label className="detail-label">
                      <Calendar size={18} />
                      {t('accountPage.joinDate')}
                    </label>
                    <span className="detail-value">{userData?.joinDate ? formatDate(userData.joinDate) : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-section">
            <h3>{t('accountPage.statsTitle')}</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <User size={24} />
                </div>
                <div className="stat-content">
                  <h4>{t('accountPage.surveysCompleted')}</h4>
                  <p className="stat-number">12</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <Calendar size={24} />
                </div>
                <div className="stat-content">
                  <h4>{t('accountPage.daysActive')}</h4>
                  <p className="stat-number">156</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <Mail size={24} />
                </div>
                <div className="stat-content">
                  <h4>{t('accountPage.messagesSent')}</h4>
                  <p className="stat-number">89</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
