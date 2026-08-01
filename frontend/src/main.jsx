import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './app'
import { Toaster } from 'react-hot-toast'
import './index.css'

// Fail fast on hung APIs instead of leaving the UI on "Loading..." for minutes.
axios.defaults.timeout = 20000;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
)