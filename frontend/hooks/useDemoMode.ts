import { useState, useEffect } from 'react';

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    const saved = localStorage.getItem('demo-mode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('demo-mode', JSON.stringify(isDemoMode));
  }, [isDemoMode]);

  const toggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  return { isDemoMode, toggleDemoMode };
}
