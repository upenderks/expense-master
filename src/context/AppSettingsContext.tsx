import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import {
  getAllUserSettings,
  getAllAppSettings,
  setUserSetting,
  setAppSetting,
} from '../lib/database';

// ── Feature keys ──────────────────────────────────────────────────────────────

export const FEATURE_KEYS = {
  MODULE_MONEY: 'module_money_enabled',
  MODULE_EXPENSE: 'module_expense_enabled',
  FEATURE_PDF_REPORT: 'feature_pdf_report',
  FEATURE_RECEIPT_PHOTO: 'feature_receipt_photo',
  FEATURE_SETTLEMENT: 'feature_settlement',
  FEATURE_BACKUP_RESTORE: 'feature_backup_restore',
  FEATURE_DARK_MODE: 'feature_dark_mode',
  FEATURE_CHARTS: 'feature_charts',
  DASHBOARD_DEFAULT: 'dashboard_default_module',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

// Default values when no setting exists
const DEFAULT_SETTINGS: Record<string, string> = {
  [FEATURE_KEYS.MODULE_MONEY]: 'true',
  [FEATURE_KEYS.MODULE_EXPENSE]: 'true',
  [FEATURE_KEYS.FEATURE_PDF_REPORT]: 'true',
  [FEATURE_KEYS.FEATURE_RECEIPT_PHOTO]: 'true',
  [FEATURE_KEYS.FEATURE_SETTLEMENT]: 'true',
  [FEATURE_KEYS.FEATURE_BACKUP_RESTORE]: 'true',
  [FEATURE_KEYS.FEATURE_DARK_MODE]: 'true',
  [FEATURE_KEYS.FEATURE_CHARTS]: 'true',
  [FEATURE_KEYS.DASHBOARD_DEFAULT]: 'expense',
};

// ── Context ───────────────────────────────────────────────────────────────────

interface AppSettingsContextType {
  settings: Record<string, string>;
  isEnabled: (key: FeatureKey) => boolean;
  getSetting: (key: string) => string;
  loadSettings: (userId: number) => Promise<void>;
  settingsLoaded: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined
);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>(
    DEFAULT_SETTINGS
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const loadSettings = useCallback(async (userId: number) => {
    try {
      // Load global defaults first
      const globalSettings = await getAllAppSettings();

      // Then load user-specific overrides
      const userSettings = await getAllUserSettings(userId);

      // Merge: defaults → global → user
      const merged = {
        ...DEFAULT_SETTINGS,
        ...globalSettings,
        ...userSettings,
      };

      setSettings(merged);
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Load settings error:', error);
      setSettings(DEFAULT_SETTINGS);
      setSettingsLoaded(true);
    }
  }, []);

  const isEnabled = useCallback(
    (key: FeatureKey): boolean => {
      const value = settings[key];
      if (value === undefined) return true; // Default enabled
      return value === 'true' || value === '1';
    },
    [settings]
  );

  const getSetting = useCallback(
    (key: string): string => {
      return settings[key] || DEFAULT_SETTINGS[key] || '';
    },
    [settings]
  );

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        isEnabled,
        getSetting,
        loadSettings,
        settingsLoaded,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error(
      'useAppSettings must be used within an AppSettingsProvider'
    );
  }
  return context;
}