import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Theme, ThemeMode, getTheme } from '../theme';

const THEME_KEY = 'app_theme_mode';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<Theme>(getTheme('light'));

  // Load saved preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        setTheme(getTheme('system'));
      }
    });
    return () => listener.remove();
  }, [themeMode]);

  async function loadThemePreference() {
    try {
      const saved = await SecureStore.getItemAsync(THEME_KEY);
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        const mode = saved as ThemeMode;
        setThemeModeState(mode);
        setTheme(getTheme(mode));
      }
    } catch (error) {
      console.error('Load theme error:', error);
    }
  }

  async function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode);
    setTheme(getTheme(mode));
    try {
      await SecureStore.setItemAsync(THEME_KEY, mode);
    } catch (error) {
      console.error('Save theme error:', error);
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        isDark: theme.dark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}