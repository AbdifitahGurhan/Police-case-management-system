// src/services/api.js — Axios instance with JWT interceptor
import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001/api';
const FALLBACK_API_URL = API_URL.includes('127.0.0.1')
  ? API_URL.replace('127.0.0.1', 'localhost')
  : API_URL.replace('localhost', '127.0.0.1');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const notify = (type, message, description) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('police-cms-notify', {
    detail: { type, message, description },
  }));
};

// Add a request interceptor to attach JWT
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle unauthorized/expired token
api.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      notify('success', response.data?.message || 'Action completed successfully.');
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!error.response && originalRequest && !originalRequest._networkRetry && FALLBACK_API_URL !== API_URL) {
      originalRequest._networkRetry = true;
      originalRequest.baseURL = FALLBACK_API_URL;
      return api(originalRequest);
    }

    if (error.response && error.response.status === 401) {
      // Clear cookie only when the token is missing or expired.
      Cookies.remove('token');
      Cookies.remove('user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
         window.location.href = '/login';
      }
    }
    if (error.response?.status !== 401) {
      notify(
        'error',
        error.response?.data?.message || 'Request failed.',
        error.response?.data?.error || error.message
      );
    }
    return Promise.reject(error);
  }
);

export default api;
