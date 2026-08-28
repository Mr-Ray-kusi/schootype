import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './app'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import './index.css'
import { enqueueMutation, isOfflineMutationUrl, mutationLabel } from './utils/offlineQueue'

axios.defaults.timeout = 20000;

axios.interceptors.request.use(async (config) => {
  const method = String(config.method || 'get').toLowerCase();
  const url = config.url || '';
  const mutating = method !== 'get' && method !== 'head' && method !== 'options';
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (mutating && offline && isOfflineMutationUrl(url)) {
    await enqueueMutation({
      method,
      url,
      data: config.data,
      headers: config.headers,
      label: mutationLabel(method, url, config.data),
    });
    toast.success('Saved offline — it will sync when you are back online');
    const error = new Error('Queued offline');
    error.offlineQueued = true;
    return Promise.reject(error);
  }

  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.offlineQueued) return Promise.reject(error);
    const config = error?.config;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    const noResponse = !error?.response;
    if (config && (offline || noResponse)) {
      const method = String(config.method || 'get').toLowerCase();
      const url = config.url || '';
      if (method !== 'get' && isOfflineMutationUrl(url)) {
        await enqueueMutation({
          method,
          url,
          data: config.data,
          headers: config.headers,
          label: mutationLabel(method, url, config.data),
        });
        toast.success('Saved offline — it will sync when you are back online');
        error.offlineQueued = true;
      }
    }
    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
)
