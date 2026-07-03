import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [school, setSchool] = useState(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const savedSchool = localStorage.getItem('school');
      if (savedSchool) {
        setSchool(JSON.parse(savedSchool));
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const signup = async (schoolName, email, password) => {
    try {
      const response = await axios.post('/api/auth/signup', { schoolName, email, password });
      const { token, school: schoolData } = response.data;
      setToken(token);
      setSchool(schoolData);
      localStorage.setItem('token', token);
      localStorage.setItem('school', JSON.stringify(schoolData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return response.data;
    } catch (error) {
      throw error;
    }
  };
// email section to allow logins
  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, school: schoolData } = response.data;
      setToken(token);
      setSchool(schoolData);
      localStorage.setItem('token', token);
      localStorage.setItem('school', JSON.stringify(schoolData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setSchool(null);
    localStorage.removeItem('token');
    localStorage.removeItem('school');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ token, school, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};