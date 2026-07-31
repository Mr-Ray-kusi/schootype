import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { hasFeature as planHasFeature } from '../constants/plans';

const AuthContext = createContext();

/** How often pending school admins check whether a super admin approved their plan. */
const PLAN_APPROVAL_POLL_MS = 5000;

export const useAuth = () => useContext(AuthContext);

export const getPostAuthPath = (school) => {
  if (school?.role === 'super_admin') return '/super-admin';
  if (!school?.payment_plan) return '/select-plan';
  return '/dashboard';
};

const isAuthRoute = (url = '') => url.includes('/api/auth/login') || url.includes('/api/auth/signup');

const readCachedSchool = () => {
  try {
    const raw = localStorage.getItem('school');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    localStorage.removeItem('school');
    return null;
  }
};

const schoolApprovalSnapshot = (school) =>
  [
    school?.plan_status,
    school?.plan_approved,
    school?.subscription_active,
    school?.subscription_frozen,
    (school?.plan_features || []).join(','),
  ].join('|');

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const schoolRef = useRef(null);

  const persistSchool = (schoolData) => {
    schoolRef.current = schoolData;
    setSchool(schoolData);
    try {
      localStorage.setItem('school', JSON.stringify(schoolData));
    } catch {
      // ignore quota / private mode failures
    }
  };

  const clearSession = useCallback(() => {
    setToken(null);
    setSchool(null);
    schoolRef.current = null;
    localStorage.removeItem('token');
    localStorage.removeItem('school');
    localStorage.removeItem('tokenExpiresAt');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const storeSession = useCallback((newToken, schoolData, expiresInSec) => {
    setToken(newToken);
    persistSchool(schoolData);
    localStorage.setItem('token', newToken);
    if (expiresInSec) {
      localStorage.setItem('tokenExpiresAt', String(Date.now() + expiresInSec * 1000));
    } else {
      localStorage.removeItem('tokenExpiresAt');
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }, []);

  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('token');
      const expiresAt = localStorage.getItem('tokenExpiresAt');
      const cachedSchool = readCachedSchool();

      if (storedToken && expiresAt && Date.now() > Number(expiresAt)) {
        clearSession();
        setLoading(false);
        return;
      }

      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Restore immediately so a refresh does not bounce to login while the API wakes.
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      setToken(storedToken);
      if (cachedSchool) {
        schoolRef.current = cachedSchool;
        setSchool(cachedSchool);
      }

      try {
        const response = await axios.get('/api/auth/verify', { timeout: 45000 });
        if (response.data?.school) {
          persistSchool(response.data.school);
        } else if (!cachedSchool) {
          // Token accepted but no school payload and nothing cached.
          clearSession();
        }
      } catch (error) {
        const status = error.response?.status;
        // Only force logout on real auth failures — not cold starts / network blips.
        if (status === 401 || status === 403) {
          clearSession();
        }
      }

      setLoading(false);
    };

    validateToken();
  }, [clearSession]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url || '';
        // Don't logout on verify retries or transient API errors.
        if (status === 401 && !isAuthRoute(url) && !url.includes('/api/auth/verify')) {
          clearSession();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [clearSession]);

  const signup = async (schoolName, email, password, logo = null, paymentPlan = null) => {
    const response = await axios.post('/api/auth/signup', {
      schoolName,
      email,
      password,
      logo,
      paymentPlan,
    });
    const { token: newToken, school: schoolData, expiresIn } = response.data;
    storeSession(newToken, schoolData, expiresIn);
    return response.data;
  };

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password });
    const { token: newToken, school: schoolData, expiresIn } = response.data || {};
    if (!newToken || !schoolData) {
      const err = new Error('Login response was invalid. The API may still be starting or misconfigured.');
      err.response = { data: { error: err.message } };
      throw err;
    }
    storeSession(newToken, schoolData, expiresIn);
    return response.data;
  };

  const selectPlan = async (paymentPlan) => {
    const response = await axios.post('/api/school/select-plan', { paymentPlan });
    persistSchool(response.data.school);
    return response.data;
  };

  const refreshSchool = useCallback(async () => {
    const response = await axios.get('/api/auth/verify', { timeout: 45000 });
    if (response.data.school) {
      persistSchool(response.data.school);
    }
    return response.data.school;
  }, []);

  // Keep school-admin UI in sync when a super admin approves (or revokes) without a page refresh.
  useEffect(() => {
    if (loading || !token) return;
    const current = schoolRef.current || school;
    if (!current || current.role === 'super_admin') return;
    if (!current.payment_plan || current.plan_approved) return;

    let cancelled = false;
    let inFlight = false;

    const pollApproval = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const response = await axios.get('/api/auth/verify', { timeout: 20000 });
        const next = response.data?.school;
        if (cancelled || !next) return;

        const prev = schoolRef.current;
        if (prev && schoolApprovalSnapshot(prev) === schoolApprovalSnapshot(next)) {
          return;
        }

        const wasApproved = prev?.plan_approved === true;
        persistSchool(next);
        if (!wasApproved && next.plan_approved) {
          toast.success('Your plan was approved! Features are now unlocked.');
        }
      } catch {
        // Ignore transient API errors while waiting for approval.
      } finally {
        inFlight = false;
      }
    };

    const intervalId = setInterval(pollApproval, PLAN_APPROVAL_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        pollApproval();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', pollApproval);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', pollApproval);
    };
  }, [loading, token, school?.role, school?.payment_plan, school?.plan_approved]);

  const logout = () => {
    clearSession();
  };

  const isSuperAdmin = school?.role === 'super_admin';
  const isPlanApproved = isSuperAdmin || school?.plan_approved === true;
  const isSubscriptionActive = isSuperAdmin || school?.subscription_active !== false;

  const includesPlanFeature = (featureKey) => {
    if (isSuperAdmin) return true;
    if (!featureKey) return false;
    // Prefer live API features, but fall back to the client plan definition so
    // newly added keys (e.g. bank-settings) still appear after a backend restart lag.
    if (school?.pending_plan_features?.includes(featureKey)) return true;
    return planHasFeature(school?.payment_plan, featureKey);
  };

  const hasFeature = (featureKey) => {
    if (isSuperAdmin) return true;
    if (!featureKey) return false;
    if (!isPlanApproved) return false;
    if (!isSubscriptionActive) return false;
    if (school?.plan_features?.includes(featureKey)) return true;
    return planHasFeature(school?.payment_plan, featureKey);
  };

  const hasMessaging = hasFeature('messages-sms') || hasFeature('messages-email');

  return (
    <AuthContext.Provider
      value={{
        token,
        school,
        isSuperAdmin,
        isPlanApproved,
        isSubscriptionActive,
        includesPlanFeature,
        hasFeature,
        hasMessaging,
        signup,
        login,
        selectPlan,
        refreshSchool,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
