// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';       // import Tailwind + any global styles
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ThemeProvider } from './ThemeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// If you want performance metrics:
reportWebVitals();
