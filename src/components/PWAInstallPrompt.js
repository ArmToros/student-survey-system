import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import './PWAInstallPrompt.css';

/**
 * PWA Install Prompt Component
 * 
 * This component shows an installation prompt for the PWA.
 * It automatically detects if the app is installable and shows a banner.
 * 
 * Usage:
 * Add this component to your App.js or any top-level component:
 * 
 * import PWAInstallPrompt from './components/PWAInstallPrompt';
 * 
 * function App() {
 *   return (
 *     <>
 *       <PWAInstallPrompt />
 *       {/* rest of your app *\/}
 *     </>
 *   );
 * }
 */

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the default mini-infobar
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e);
      // Show our custom install prompt
      setShowPrompt(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now() + 7 * 24 * 60 * 60 * 1000);
  };

  // Don't show anything if already installed or prompt not available
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <Download size={24} />
        </div>
        <div className="pwa-install-text">
          <h3>Install App</h3>
          <p>Install this app for a better experience with offline access!</p>
        </div>
        <button className="pwa-install-button" onClick={handleInstallClick}>
          Install
        </button>
        <button className="pwa-dismiss-button" onClick={handleDismiss}>
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;

