/**
 * The top bar: the programme name, the nav, and the account menu.
 *
 * The one piece worth knowing about is the nav labels. They show when they fit
 * and collapse to icons when they do not, and which happens is measured rather
 * than decided at a fixed width - see the effect below. A breakpoint cannot
 * answer it, because the labels are far longer in Armenian than in English and
 * an admin has two more of them than a student.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Home,
  Newspaper,
  MessageCircle,
  User,
  Settings,
  LogOut,
  ChevronDown,
  ShieldCheck,
  GraduationCap,
  Menu,
  X, BookOpen } from 'lucide-react';
import './Header.css';

const COMPACT_CLASS = 'is-compact';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
const Header = () => {
  const { t, language } = useLanguage();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const headerContentRef = useRef(null);
  // Nav labels are shown when they fit and collapse to icons when they do not.
  // A width threshold cannot decide this, because how much room the labels need
  // depends on the language: in Armenian the six labels want 969px and the
  // programme name another 682px, which is wider than any laptop. So measure.
  const [isCompactNav, setIsCompactNav] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Only staff may create surveys, so students are not offered the link at all.
  // Authoring surveys is an admin job; lecturers read the results like everyone else.
  const canCreateSurvey = user?.role === 'admin';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target) && 
          !event.target.closest('.mobile-menu-button')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    const node = headerContentRef.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      // Below the mobile breakpoint the nav moves into the drop-down panel,
      // where every label has a line to itself and always fits.
      if (window.innerWidth <= 768) {
        setIsCompactNav(false);
        return;
      }

      // Measure what the row wants with the labels showing, whether or not
      // they are showing at the moment. Comparing that against the room
      // available is a stable question with the same answer each time, so
      // the header settles instead of flipping between the two states.
      const wasCompact = node.classList.contains(COMPACT_CLASS);
      if (wasCompact) {
        node.classList.remove(COMPACT_CLASS);
      }

      const wanted = node.scrollWidth;
      const room = node.clientWidth;

      if (wasCompact) {
        node.classList.add(COMPACT_CLASS);
      }

      setIsCompactNav(wanted > room + 1);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, [language, user?.role]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Auto-scroll mobile menu when dropdown opens/closes
  useEffect(() => {
    if (!mobileMenuRef.current || !isMobileMenuOpen) return;

    const mobileMenuElement = mobileMenuRef.current;
    
    if (isDropdownOpen) {
      // Scroll to bottom when dropdown opens
      setTimeout(() => {
        mobileMenuElement.scrollTo({
          top: mobileMenuElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 100); // Small delay to ensure dropdown is rendered
    } else {
      // Scroll to top when dropdown closes
      setTimeout(() => {
        mobileMenuElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [isDropdownOpen, isMobileMenuOpen]);

  return (
    <>
      {isMobileMenuOpen && (
        <div 
          className="mobile-menu-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <header className="header">
        <div className="container">
          <div
            className={`header-content ${isCompactNav ? COMPACT_CLASS : ''}`}
            ref={headerContentRef}
          >
            <Link to="/" className="logo">
              <img 
                src={theme === 'dark' ? '/logo/logo-white.jpg' : '/logo/logo-black.jpg'} 
                alt="Logo" 
                className="logo-image"
              />
              <span>{t('header.sss')}</span>
            </Link>
            
            <button 
              className="mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <div className={`header-right ${isMobileMenuOpen ? 'mobile-open' : ''} ${isMobileMenuOpen && isDropdownOpen ? 'has-dropdown-open' : ''}`} ref={mobileMenuRef}>
            <nav className="nav">
              <Link
                to="/" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Home size={20} />
                <span className="nav-link-text">{t('dashboard.title')}</span>
              </Link>
              <Link
                to="/courses"
                className={`nav-link ${isActive('/courses') ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <BookOpen size={20} />
                <span className="nav-link-text">{t('courses.title')}</span>
              </Link>
              <Link 
                to="/news" 
                className={`nav-link ${isActive('/news') ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Newspaper size={20} />
                <span className="nav-link-text">{t('news.title')}</span>
              </Link>
              <Link 
                to="/chat" 
                className={`nav-link ${isActive('/chat') ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <MessageCircle size={20} />
                <span className="nav-link-text">{t('chat.title')}</span>
              </Link>
              {canCreateSurvey && (
                <Link
                  to="/create-survey"
                  className={`nav-link ${isActive('/create-survey') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Plus size={20} />
                  <span className="nav-link-text">{t('createSurvey.pageTitle')}</span>
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <ShieldCheck size={20} />
                  <span className="nav-link-text">{t('header.adminConsole')}</span>
                </Link>
              )}
              {user?.role === 'lecturer' && (
                <Link
                  to="/lecturer"
                  className={`nav-link ${isActive('/lecturer') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <GraduationCap size={20} />
                  <span className="nav-link-text">{t('header.lecturerConsole')}</span>
                </Link>
              )}
            </nav>

            <div className={`account-menu ${isDropdownOpen ? 'dropdown-open' : ''}`} ref={dropdownRef}>
              <button 
                className="account-button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className="account-avatar">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="avatar" className="account-avatar-image" />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <span className="account-name">
                  {user ? `${user.firstName} ${user.lastName}` : t('header.fullName')}
                </span>
                <ChevronDown size={16} className={`chevron ${isDropdownOpen ? 'open' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <div className="user-info">
                      <div className="user-avatar">
                        <User size={24} />
                      </div>
                      <div className="user-details">
                        <div className="user-name">
                          {user ? `${user.firstName} ${user.lastName}` : t('header.fullName')}
                        </div>
                        <div className="user-email">{user?.email || 'ashughyan.sergey@university.edu'}</div>
                        {user && (
                          <div className="user-role">
                            {t(`header.roleLabels.${user.role}`)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="dropdown-divider"></div>
                  
                  <div className="dropdown-items">
                    <Link to="/account" className="dropdown-item">
                      <User size={18} />
                      <span>{t('accountPage.title')}</span>
                    </Link>
                    <Link to="/settings" className="dropdown-item">
                      <Settings size={18} />
                      <span>{t('settings.title')}</span>
                    </Link>
                  </div>
                  
                  <div className="dropdown-divider"></div>
                  
                  <div className="dropdown-items">
                    <button
                      className="dropdown-item logout"
                      onClick={() => {
                        logout();
                        navigate('/login');
                        setIsDropdownOpen(false);
                      }}
                    >
                      <LogOut size={18} />
                      <span>{t('header.signOut')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
    </>
  );
};

export default Header;
