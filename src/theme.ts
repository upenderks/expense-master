import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSoft: string;
  surfaceElevated: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primarySoft: string;
  secondary: string;
  secondaryDark: string;
  secondarySoft: string;
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
  cardBorder: string;
  tabBar: string;
  tabBarBorder: string;
  modalBg: string;
  gradient1: string;
  gradient2: string;
  headerGradient1: string;
  headerGradient2: string;
  accentGlow: string;
}

export interface Theme {
  colors: ThemeColors;
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  shadows: {
    sm: object;
    md: object;
    lg: object;
  };
  dark: boolean;
}

const lightColors: ThemeColors = {
  background: '#f0f4ff',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  surfaceElevated: '#ffffff',
  primary: '#4f46e5',
  primaryDark: '#3730a3',
  primaryLight: '#818cf8',
  primarySoft: '#e0e7ff',
  secondary: '#7c3aed',
  secondaryDark: '#5b21b6',
  secondarySoft: '#ede9fe',
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
  overlay: 'rgba(15, 23, 42, 0.6)',
  card: '#ffffff',
  cardBorder: '#e8ecf4',
  tabBar: '#ffffff',
  tabBarBorder: '#e2e8f0',
  modalBg: '#ffffff',
  gradient1: '#4f46e5',
  gradient2: '#7c3aed',
  headerGradient1: '#4f46e5',
  headerGradient2: '#6d28d9',
  accentGlow: 'rgba(79, 70, 229, 0.15)',
};

const darkColors: ThemeColors = {
  background: '#0a0e1a',
  surface: '#141827',
  surfaceSoft: '#1a1f33',
  surfaceElevated: '#1e2440',
  primary: '#818cf8',
  primaryDark: '#a5b4fc',
  primaryLight: '#6366f1',
  primarySoft: '#1e1b4b',
  secondary: '#a78bfa',
  secondaryDark: '#c4b5fd',
  secondarySoft: '#2e1065',
  success: '#34d399',
  successSoft: '#022c22',
  danger: '#f87171',
  dangerSoft: '#450a0a',
  warning: '#fbbf24',
  warningSoft: '#451a03',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  muted: '#94a3b8',
  border: '#1e293b',
  inputBorder: '#334155',
  inputBg: '#141827',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.75)',
  card: '#141827',
  cardBorder: '#1e293b',
  tabBar: '#0f1629',
  tabBarBorder: '#1e293b',
  modalBg: '#141827',
  gradient1: '#6366f1',
  gradient2: '#8b5cf6',
  headerGradient1: '#312e81',
  headerGradient2: '#4c1d95',
  accentGlow: 'rgba(99, 102, 241, 0.2)',
};

const commonValues = {
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
    },
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

export const theme = getTheme('light');