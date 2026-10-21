import React from 'react';
import './PageHero.css';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * The band at the top of a page: what this page is, and who is looking at it.
 *
 * The admin console had this and nothing else did - the other pages carried a
 * bare title and subtitle - so the app changed shape as you moved around it.
 * This is that same block, in one place, for every page to use.
 *
 * `eyebrow`, `title` and `subtitle` are already-translated strings, because the
 * pages hold their own wording. `chips` are small facts about the page itself
 * (how many surveys, which term); falsy entries are dropped, so a caller can
 * pass one conditionally without guarding it.
 */
const PageHero = ({ eyebrow, title, subtitle, chips = [] }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const shown = chips.filter(Boolean);

  return (
    <section className="page-hero">
      <div className="page-hero-text">
        {eyebrow && <p className="page-hero-label">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="page-hero-subtitle">{subtitle}</p>}

        {shown.length > 0 && (
          <div className="page-hero-meta">
            {shown.map((chip, index) => (
              <div key={index} className="page-hero-chip">{chip}</div>
            ))}
          </div>
        )}
      </div>

      {user && (
        <div className="page-hero-profile">
          {user.avatar && (
            <img src={user.avatar} alt={user.firstName} className="page-hero-avatar" />
          )}
          <div className="page-hero-identity">
            <div className="page-hero-name">
              {user.firstName} {user.lastName}
            </div>
            <div className="page-hero-role">{t(`header.roleLabels.${user.role}`)}</div>
            {(user.studentId || user.dbId) && (
              <div className="page-hero-id">{user.studentId || user.dbId}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PageHero;
