// src/contexts/AuthContext.js — Global authentication state
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '@/services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get('token') || localStorage.getItem('token');
      const savedUser = Cookies.get('user') || localStorage.getItem('user');

      if (token && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          const normalizedUser = {
            ...parsedUser,
            role: String(parsedUser.role || '').trim().toLowerCase(),
          };
          setUser(normalizedUser);
          Cookies.set('token', token, { expires: 1, path: '/', sameSite: 'lax' });
          Cookies.set('user', JSON.stringify(normalizedUser), { expires: 1, path: '/', sameSite: 'lax' });
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(normalizedUser));
        } catch (err) {
          console.error("Failed to parse user cookie", err);
          Cookies.remove('token');
          Cookies.remove('user');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (!pathname.startsWith('/login')) {
            router.push('/login');
          }
        }
      } else if (token && !savedUser) {
        console.warn('Saved user cookie is invalid or missing, clearing auth state.');
        Cookies.remove('token');
        Cookies.remove('user');
        if (!pathname.startsWith('/login')) {
          router.push('/login');
        }
      } else if (!pathname.startsWith('/login')) {
        // Only redirect if not already on login page
        // We'll let the user stay on login page if no token
      }
      setLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  const login = async (identifier, password) => {
    try {
      const response = await api.post('/auth/login', { username: identifier, email: identifier, password });
      const { token, user: userData } = response.data;
      const normalizedUser = {
        ...userData,
        role: String(userData.role || '').trim().toLowerCase(),
      };

      // Store in cookies (expires in 24h as per JWT)
      Cookies.set('token', token, { expires: 1, path: '/', sameSite: 'lax' });
      Cookies.set('user', JSON.stringify(normalizedUser), { expires: 1, path: '/', sameSite: 'lax' });
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      setUser(normalizedUser);
      
      const roleRedirects = {
        admin: '/dashboard/admin',
        sub_admin: '/dashboard/admin',
        personnel_registry: '/police-officers',
        investigator: '/dashboard/cid',
        station_jail: '/dashboard/jail',
        state_admin: '/dashboard/unit',
        region_admin: '/dashboard/unit',
        city_admin: '/dashboard/unit',
        district_admin: '/dashboard/unit',
        officer: '/dashboard/officer',
        cid: '/dashboard/cid',
        cid_director: '/dashboard/cid',
        cid_supervisor: '/dashboard/cid',
        cid_officer: '/dashboard/cid',
        court: '/dashboard/court',
        court_admin: '/dashboard/court',
        judge: '/dashboard/court',
        prosecutor: '/dashboard/court',
        prosecutor_liaison: '/dashboard/cid',
        court_clerk: '/dashboard/court',
        jail: '/dashboard/jail',
        state_commander: '/dashboard/unit',
        region_commander: '/dashboard/unit',
        district_commander: '/dashboard/unit',
        police_station_commander: '/dashboard/unit',
        ob_staff: '/ob-register',
        staff: '/cases'
      };
      
      router.push(roleRedirects[normalizedUser.role] || '/cases');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed. Please check your credentials.' 
      };
    }
  };

  const logout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  const updateUser = (userData) => {
    Cookies.set('user', JSON.stringify(userData), { expires: 1 });
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
