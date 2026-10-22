/**
 * Routes and the app shell.
 *
 * Every route except /login and /reset-password is wrapped in ProtectedRoute,
 * which bounces an unauthenticated visitor to the login page. A few are
 * restricted further by role.
 *
 * There is no /register: accounts are created by an admin, and the university
 * issues the addresses. The old route redirects to /login so an existing
 * bookmark lands somewhere sensible.
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Surveys from './pages/Surveys';
import SurveyForm from './pages/SurveyForm';
import CreateSurvey from './pages/CreateSurvey';
import SurveyResults from './pages/SurveyResults';
import News from './pages/News';
import Courses from './pages/Courses';
import Chat from './pages/Chat';
import Account from './pages/Account';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import Lecturer from './pages/Lecturer';
import './App.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="App">
      {!isLoginPage && <Header />}
      <main className={isLoginPage ? "main-content no-header" : "main-content"}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Accounts are created by an admin, so there is nothing to sign up for.
              Anyone arriving on an old /register link lands on the login page. */}
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys"
            element={
              <ProtectedRoute>
                <Surveys />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveys/:id"
            element={
              <ProtectedRoute>
                <SurveyForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-survey"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateSurvey />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/:id"
            element={
              <ProtectedRoute>
                <SurveyResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <Courses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/news"
            element={
              <ProtectedRoute>
                <News />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer"
            element={
              <ProtectedRoute allowedRoles={['lecturer']}>
                <Lecturer />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
