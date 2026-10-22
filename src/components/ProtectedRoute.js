/**
 * The route guard. No user means the login page; a user without one of
 * `allowedRoles` goes back to the dashboard rather than seeing a refusal.
 *
 * This is convenience, not security: it decides what to render, and every
 * endpoint checks the caller's role again on the server. Removing it would
 * expose empty screens, not data.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;

