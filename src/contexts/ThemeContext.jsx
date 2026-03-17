import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'taskmarket_theme';
const DEFAULT_THEME = 'light';

const applyTheme = (nextTheme) => {
  document.documentElement.setAttribute('data-theme', nextTheme);
  document.documentElement.classList.toggle('dark', nextTheme === 'dark');
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, nextTheme);
      applyTheme(nextTheme);
      return nextTheme;
    });
  };

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
