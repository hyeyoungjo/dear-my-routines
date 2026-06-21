"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "lavender" | "slate" | "dark";
export const THEMES: Theme[] = ["lavender", "slate", "dark"];

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "lavender", setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

/**
 * Theme state: persists the chosen theme in localStorage and reflects it as
 * `data-theme` on <html> (globals.css maps each to a color palette). Default is
 * "lavender". FOUC is minimal since lavender is the :root default.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("lavender");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved && THEMES.includes(saved)) {
      setThemeState(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    document.documentElement.dataset.theme = t;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
