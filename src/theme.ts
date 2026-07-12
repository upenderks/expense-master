import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSoft: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  inputBorder: string;
  inputBg: string;
  shadow: string;
  overlay: string;
  card: string;
  tabBar: string;
  tabBarBorder: string;
  modalBg: string;
}

export interface Theme {
  colors: ThemeColors;
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  dark: boolean;
}

const lightColors: ThemeColors = {
  background: '#f3f6fb',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primarySoft: '#dbeafe',
  success: '#059669',
  successSoft: '#d1fae5',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  warning: '#d97706',
  warningSoft: '#ffedd5',
  text: '#0f172a',
  textSecondary: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  inputBorder: '#cbd5e1',
  inputBg: '#ffffff',
  shadow: '#0f172a',
  overlay: 'rgba(15, 23, 42, 0.55)',
  card: '#ffffff',
  tabBar: '#ffffff',
  tabBarBorder: '#e2e8f0',
  modalBg: '#ffffff',
};

const darkColors: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceSoft: '#1e293b',
  primary: '#3b82f6',
  primaryDark: '#60a5fa',
  primarySoft: '#1e3a5f',
  success: '#10b981',
  successSoft: '#064e3b',
  danger: '#ef4444',
  dangerSoft: '#450a0a',
  warning: '#f59e0b',
  warningSoft: '#451a03',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  muted: '#94a3b8',
  border: '#334155',
  inputBorder: '#475569',
  inputBg: '#1e293b',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  card: '#1e293b',
  tabBar: '#1e293b',
  tabBarBorder: '#334155',
  modalBg: '#1e293b',
};

const commonValues = {
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
};

export function getTheme(mode: ThemeMode): Theme {
  let isDark = false;

  if (mode === 'system') {
    isDark = Appearance.getColorScheme() === 'dark';
  } else {
    isDark = mode === 'dark';
  }

  return {
    colors: isDark ? darkColors : lightColors,
    ...commonValues,
    dark: isDark,
  };
}

// Default export for backward compatibility
export const theme = getTheme('light');