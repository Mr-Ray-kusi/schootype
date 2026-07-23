import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { hasFeature as planHasFeature } from '../constants/plans';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const getPostAuthPath = (school) => {
  if (school?.role === 'super_admin') return '/super-admin';
  if (!school?.payment_plan) return '/select-plan';
  return '/dashboard';
};

const isAuthRoute = (url = '') => url.includes('/api/auth/login') || url.includes('/api/auth/signup');

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistSchool = (schoolData) => {
    setSchool(schoolData);
    localStorage.setItem('school', JSON.stringify(schoolData));
  };

  const clearSession = useCallback(() => {
    setToken(null);
    setSchool(null);
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

      if (storedToken && expiresAt && Date.now() > Number(expiresAt)) {
        clearSession();
        setLoading(false);
        return;
      }

      if (storedToken) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const response = await axios.get('/api/auth/verify');

          setToken(storedToken);
          if (response.data.school) {
            persistSchool(response.data.school);
          } else {
            const savedSchool = localStorage.getItem('school');
            if (savedSchool) {
              setSchool(JSON.parse(savedSchool));
            }
          }
        } catch {
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
        if ((status === 401 || status === 403) && !isAuthRoute(url)) {
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
    const { token: newToken, school: schoolData, expiresIn } = response.data;
    storeSession(newToken, schoolData, expiresIn);
    return response.data;
  };

  const selectPlan = async (paymentPlan) => {
    const response = await axios.post('/api/school/select-plan', { paymentPlan });
    persistSchool(response.data.school);
    return response.data;
  };

  const refreshSchool = async () => {
    const response = await axios.get('/api/auth/verify');
    if (response.data.school) {
      persistSchool(response.data.school);
    }
    return response.data.school;
  };

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
