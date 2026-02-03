// src/ThemeContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Initialize theme from localStorage or system preference
  const [theme, setTheme] = useState(() => {
	const stored = window.localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark') {
	  return stored;
	}
	return window.matchMedia('(prefers-color-scheme: dark)').matches
	  ? 'dark'
	  : 'light';
  });

  useEffect(() => {
	const root = document.documentElement;
	if (theme === 'dark') {
	  root.classList.add('dark');
	} else {
	  root.classList.remove('dark');
	}
	window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => {
	setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
	<ThemeContext.Provider value={{ theme, toggle }}>
	  {children}
	</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
	throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
