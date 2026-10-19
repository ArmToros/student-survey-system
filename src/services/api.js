const LOCAL_API_BASE_URL = 'http://localhost:5001';

const TOKEN_STORAGE_KEY = 'sss-auth-token';

/** Fired when the API rejects our token, so AuthContext can sign the user out. */
export const AUTH_EXPIRED_EVENT = 'sss-auth-expired';

const normalizeBaseUrl = (url) => url.replace(/\/+$/, '');

export const getApiBaseUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_BASE_URL;

  if (configuredUrl && configuredUrl.trim()) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (!isLocalHost) {
      return '';
    }
  }

  return LOCAL_API_BASE_URL;
};

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};

const readStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to read the stored access token', error);
    return null;
  }
};

// Kept in memory as well as in storage so every request can read it cheaply.
let authToken = readStoredToken();

export const getAuthToken = () => authToken;

export const setAuthToken = (token) => {
  authToken = token || null;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (authToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Unable to persist the access token', error);
  }
};

/** Endpoints that are reachable without a token and must not trigger a sign-out. */
const isAnonymousPath = (path) => path.startsWith('/api/auth/') || path.startsWith('/api/health');

export const apiFetch = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});

  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch (error) {
    const nextError = new Error('API_NETWORK_ERROR');
    nextError.cause = error;
    throw nextError;
  }

  // An expired or rejected token should end the session rather than leave the
  // app showing a signed-in shell that cannot load anything.
  if (response.status === 401 && authToken && !isAnonymousPath(path)) {
    setAuthToken(null);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
  }

  return response;
};
