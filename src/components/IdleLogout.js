import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Signs the person out after a stretch of no activity.
 *
 * This used to live in the Settings page, which meant the timer only ran while
 * that page was open: you could leave the app sitting on the dashboard all
 * afternoon and it would never log you out. The setting said otherwise. It
 * belongs at the top of the app, where it can watch the whole session.
 *
 * Renders nothing. Mounted once, inside the auth provider.
 */
const IdleLogout = () => {
  const { user, logout } = useAuth();

  const account = user?.preferences?.account;
  const enabled = Boolean(user) && account?.autoLogout !== false;
  const minutes = Number(account?.sessionTimeout) || 30;

  // Held in a ref so a changed logout function does not restart the countdown.
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let timer;

    const start = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        logoutRef.current();
      }, minutes * 60 * 1000);
    };

    // "Activity" is deliberately broad: reading a long survey without touching
    // the mouse is still using the app.
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus'];
    events.forEach(event => window.addEventListener(event, start, { passive: true }));
    start();

    return () => {
      window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, start));
    };
  }, [enabled, minutes]);

  return null;
};

export default IdleLogout;
