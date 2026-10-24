/**
 * A person's own profile.
 *
 * Read-only for students and lecturers: the fields here are administrative
 * data, so they ask support to change them and an admin edits them from the
 * console. The picture is the exception - anyone may change their own.
 *
 * Surveys completed and messages sent are counted from real rows. The third
 * figure is not: `daysActive` is simply today minus the join date, because
 * nothing in the database records a visit. It is labelled "days since joining"
 * for that reason - see the note where it is rendered.
 *
 * Anything unknown shows a dash rather than a zero, because a zero reads as a
 * fact.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Calendar, Edit3, Save, X, Camera, Trash2, GraduationCap, MessageCircle } from 'lucide-react';
import './Account.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';
import PageHero from '../components/PageHero';


const Account = () => {
  const {  t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const { user, updateUser } = useAuth();
  // An account is administrative data. Admins change it; everyone else reads
  // their own and asks support for a correction.
  const isAdmin = user?.role === 'admin';
  const [userData, setUserData] = useState(user);
  const [editData, setEditData] = useState({ ...userData });
  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  // Counted from the data rather than invented: the panel used to show the
  // same three numbers to every account.
  const [stats, setStats] = useState(null);
  const isStudent = user?.role === 'student';
  const isLecturer = user?.role === 'lecturer';
  // The signed-in account is cached from the login, so the page re-reads it to
  // pick up anything an admin has changed since.
  useEffect(() => {
    if (!user?.dbId) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await apiFetch(`/api/users/${user.dbId}`);
        if (!response.ok) {
          throw new Error('ACCOUNT_FAILED');
        }
        const data = await response.json();
        if (!cancelled) {
          setUserData(data);
          setEditData({ ...data });
        }
      } catch (error) {
        console.warn('Unable to refresh the account', error);
      }
    };

    refresh();
    return () => { cancelled = true; };
  }, [user?.dbId]);

  useEffect(() => {
    if (!user?.dbId) {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      try {
        const response = await apiFetch(`/api/users/${user.dbId}/statistics`);
        if (!response.ok) {
          throw new Error('STATS_FAILED');
        }
        const data = await response.json();
        if (!cancelled) {
          setStats(data);
        }
      } catch (error) {
        console.warn('Unable to load the account statistics', error);
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [user?.dbId]);

  // The picture is uploaded on its own, not with the rest of the profile, so
  // choosing one takes effect immediately and does not need the edit mode.
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !userData?.dbId) {
      return;
    }

    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.append('file', file);

      // No Content-Type header here on purpose: the browser has to set the
      // multipart boundary itself.
      const response = await apiFetch(`/api/users/${userData.dbId}/photo`, {
        method: 'POST',
        body
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'UPLOAD_FAILED');
      }

      setUserData(data);
      updateUser(data);
    } catch (error) {
      console.error(error);
      setPhotoError(error.message === 'UPLOAD_FAILED' ? t('accountPage.photoFailed') : error.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!userData?.dbId) {
      return;
    }

    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const response = await apiFetch(`/api/users/${userData.dbId}/photo`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('REMOVE_FAILED');
      }
      const data = await response.json();
      setUserData(data);
      updateUser(data);
    } catch (error) {
      console.error(error);
      setPhotoError(t('accountPage.photoFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const displayId = userData?.studentId || userData?.dbId || userData?.id?.split('-').pop() || '—';

  // The same field holds the account number for every role, so only the label
  // changes: a lecturer is not carrying a student id.
  const ID_LABEL_KEYS = {
    student: 'accountPage.studentId',
    lecturer: 'accountPage.lecturerId',
    admin: 'accountPage.adminId'
  };
  const idLabel = t(ID_LABEL_KEYS[userData?.role] || 'accountPage.accountId');

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
<PageHero
          eyebrow={t('accountPage.eyebrow')}
          title={t('accountPage.title')}
          subtitle={t('accountPage.subtitle')}
        />

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
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={uploadPhoto}
                    className="avatar-file-input"
                  />
                  <button
                    className="avatar-edit-btn"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoBusy}
                    title={t('accountPage.changePhoto')}
                  >
                    <Camera size={16} />
                  </button>
                  {userData?.avatar && (
                    <button
                      className="avatar-remove-btn"
                      onClick={removePhoto}
                      disabled={photoBusy}
                      title={t('accountPage.removePhoto')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="profile-info">
                  <h2>{userData?.firstName} {userData?.lastName}</h2>
                  {photoError && <p className="photo-error">{photoError}</p>}
                  <p className="profile-email">{userData?.email}</p>
                  <p className="profile-role">{userData?.roleLabel}</p>
                </div>
                <div className="profile-actions">
                  {!isAdmin ? (
                    <Link to="/chat" className="btn btn-outline">
                      <MessageCircle size={16} />
                      {t('accountPage.askSupport')}
                    </Link>
                  ) : !isEditing ? (
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

                  {isStudent && (
                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                      {idLabel}
                    </label>
                    <span className="detail-value">{displayId}</span>
                  </div>
                  )}

                  {isStudent && (
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
                  )}

                  {isStudent && (
                  <div className="detail-item">
                    <label className="detail-label">
                      <User size={18} />
                      {t('accountPage.academicYear')}
                    </label>
                    <span className="detail-value">
                      {userData?.academicYear
                        ? `${t('accountPage.year')} ${userData.academicYear}`
                        : '—'}
                    </span>
                  </div>
                  )}

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

                  {isStudent && (
                  <div className="detail-item">
                    <label className="detail-label">
                      <GraduationCap size={18} />
                      {t('accountPage.degree')}
                    </label>
                    <span className="detail-value">{userData?.degree || '—'}</span>
                  </div>
                  )}

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
                  <p className="stat-number">{stats ? stats.surveysCompleted : '—'}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <Calendar size={24} />
                </div>
                <div className="stat-content">
                  {/* Calendar days since JoinDate, not days of use - nothing
                      records a visit, so somebody who signed in once in 2021
                      and never returned reads the same as a daily user. The
                      wording says "since joining" rather than "active" so the
                      number is not claiming more than it knows. */}
                  <h4>{t('accountPage.daysActive')}</h4>
                  <p className="stat-number">{stats && stats.daysActive !== null ? stats.daysActive : '—'}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <Mail size={24} />
                </div>
                <div className="stat-content">
                  <h4>{t('accountPage.messagesSent')}</h4>
                  <p className="stat-number">{stats ? stats.messagesSent : '—'}</p>
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
