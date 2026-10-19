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
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  Menu,
  X
} from 'lucide-react';
import './Header.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
const Header = () => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const isActive = (path) => {
    return location.pathname === path;
  };

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
          <div className="header-content">
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
              <Link 
                to="/create-survey" 
                className={`nav-link ${isActive('/create-survey') ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Plus size={20} />
                <span className="nav-link-text">{t('createSurvey.pageTitle')}</span>
              </Link>
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
                    <Link 
                      to="/login" 
                      className="dropdown-item"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <RefreshCw size={18} />
                      <span>{t('header.switchAccount')}</span>
                    </Link>
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
