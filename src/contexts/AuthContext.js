import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_EXPIRED_EVENT, apiFetch, getAuthToken, setAuthToken } from '../services/api';

const STORAGE_KEY = 'sss-auth-user';

// Accounts that exist in the restored SSS database, shown by the "Quick role
// access" panel on the login page so the app can be tried without hunting for a
// login. These replace an earlier hardcoded set (admin@sss.edu / Admin@123) that
// no longer exists in the database.
//
// The passwords really are these strings: UserAccount.PasswordHash holds
// placeholder values such as "hash_admin_1" and the backend compares them in
// plain text. Replace this with real hashing before any deployment.
const DEMO_ACCOUNTS = [
  {
    role: 'admin',
    roleLabel: 'Administrator',
    firstName: 'Arman',
    lastName: 'Sargsyan',
    email: 'arman.sargsyan@uni.am',
    password: 'hash_admin_1'
  },
  {
    role: 'lecturer',
    roleLabel: 'Lecturer',
    firstName: 'Gevorg',
    lastName: 'Harutyunyan',
    email: 'gevorg.h@uni.am',
    password: 'hash_lect_1'
  },
  {
    role: 'student',
    roleLabel: 'Student',
    firstName: 'Davit',
    lastName: 'Hovhannisyan',
    email: 'davit.h@student.uni.am',
    password: 'hash_stud_1'
  }
];

const loadPersistedUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    // Every request needs the access token, so a remembered user without one
    // cannot be restored - treat that as signed out.
    if (!getAuthToken()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Unable to parse stored auth user', error);
    return null;
  }
};

const AuthContext = createContext();

const delay = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => loadPersistedUser());

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const credentialHints = useMemo(
    () =>
      DEMO_ACCOUNTS.map(({ role, roleLabel, email, password, firstName, lastName }) => ({
        role,
        roleLabel,
        email,
        password,
        name: `${firstName} ${lastName}`
      })),
    []
  );

  const login = async (email, password) => {
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password })
      });

      // Too many attempts is a different problem from a wrong password and
      // must not be reported as one.
      if (response.status === 429) {
        throw new Error('TOO_MANY_ATTEMPTS');
      }

      if (!response.ok) {
        throw new Error('INVALID_CREDENTIALS');
      }

      const session = await response.json();
      setAuthToken(session.token);

      const safeUser = session.user;
      setUser(safeUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
      return safeUser;
    } catch (err) {
      console.error(err);
      setAuthToken(null);

      if (err?.message === 'TOO_MANY_ATTEMPTS') {
        throw err;
      }

      throw new Error('INVALID_CREDENTIALS');
    }
  };

  const register = async (name, email, password) => {
    const normalizedEmail = email.toLowerCase().trim();

    // Validation
    if (!normalizedEmail || !password || !name) {
      throw new Error('MISSING_FIELDS');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error('INVALID_EMAIL');
    }

    let response;
    try {
      response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email: normalizedEmail, password })
      });
    } catch (networkErr) {
      console.error(networkErr);
      throw new Error('NETWORK_ERROR');
    }

    if (!response.ok) {
      let apiMessage = '';
      try {
        const errBody = await response.json();
        apiMessage = String(errBody?.message ?? errBody?.title ?? '');
      } catch {
        // non-JSON error body
      }

      const looksLikeDuplicate =
        response.status === 400 &&
        /email\s+already|already\s+exists|duplicate/i.test(apiMessage);

      if (looksLikeDuplicate) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      if (response.status >= 500) {
        throw new Error('SERVER_ERROR');
      }

      throw new Error('REGISTRATION_FAILED');
    }

    try {
      const session = await response.json();
      setAuthToken(session.token);

      const safeUser = session.user;
      setUser(safeUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
      return safeUser;
    } catch (parseErr) {
      console.error(parseErr);
      throw new Error('INVALID_RESPONSE');
    }
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const requestPasswordReset = async (email) => {
    const normalized = (email || '').trim();

    if (!normalized) {
      throw new Error('EMAIL_REQUIRED');
    }

    const response = await apiFetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalized.toLowerCase() })
    });

    if (response.status === 429) {
      throw new Error('TOO_MANY_ATTEMPTS');
    }

    // The API answers the same way for a registered and an unregistered address,
    // so there is deliberately nothing here to tell the two apart.
    if (!response.ok) {
      throw new Error('REQUEST_FAILED');
    }

    return response.json();
  };

  /// Redeems the token from the emailed link and sets the new password.
  const confirmPasswordReset = async (token, password) => {
    if (!token) {
      throw new Error('INVALID_TOKEN');
    }

    if (!password || password.length < 8) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    let response;
    try {
      response = await apiFetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password })
      });
    } catch (networkErr) {
      console.error(networkErr);
      throw new Error('NETWORK_ERROR');
    }

    if (response.status === 429) {
      throw new Error('TOO_MANY_ATTEMPTS');
    }

    if (!response.ok) {
      // Expired, already used or simply wrong all look the same from here.
      throw new Error('INVALID_TOKEN');
    }

    return response.json();
  };

  const hasRole = (roles = []) => {
    if (!user) {
      return false;
    }

    if (!roles.length) {
      return true;
    }

    return roles.includes(user.role);
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    updateUser,
    requestPasswordReset,
    confirmPasswordReset,
    hasRole,
    credentialHints,
    roles: {
      ADMIN: 'admin',
      LECTURER: 'lecturer',
      STUDENT: 'student'
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
