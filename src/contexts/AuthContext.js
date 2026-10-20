import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_EXPIRED_EVENT, apiFetch, getAuthToken, setAuthToken } from '../services/api';

const STORAGE_KEY = 'sss-auth-user';

// Accounts that exist in the restored SSS database, offered on the login page
// so the app can be tried without hunting for a login.
//
// The passwords below are the placeholders the backup ships with. They only
// work on a database that has not had "npm run db:set-passwords" run against
// it; once it has, these open nothing, which is why the hints are shown on
// localhost alone.
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

  // Only ever shown on localhost. Published anywhere else - a Tailscale name, a
  // server, the proxy on the VPS - the panel would print working addresses of
  // real accounts on a page anyone can open, so it is withheld. The passwords it
  // lists are the placeholders from the backup and stop working as soon as
  // "npm run db:set-passwords" has been run.
  const credentialHints = useMemo(
    () => {
      const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return [];
      }

      return DEMO_ACCOUNTS.map(({ role, roleLabel, email, password, firstName, lastName }) => ({
        role,
        roleLabel,
        email,
        password,
        name: `${firstName} ${lastName}`
      }));
    },
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
