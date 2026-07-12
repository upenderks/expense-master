import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { Language, TranslationKey, t as translate } from '../i18n/translations';
import { getUserSetting, setUserSetting } from '../lib/database';

const LANGUAGE_KEY = 'app_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language, userId?: number) => Promise<void>;
  t: (key: TranslationKey) => string;
  loadLanguage: (userId: number) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>('en');

  const loadLanguage = useCallback(async (userId: number) => {
    try {
      const saved = await getUserSetting(userId, LANGUAGE_KEY);
      if (saved && (saved === 'en' || saved === 'hi')) {
        setLang(saved as Language);
      }
    } catch (error) {
      console.error('Load language error:', error);
    }
  }, []);

  const setLanguage = useCallback(async (lang: Language, userId?: number) => {
    setLang(lang);
    if (userId) {
      try {
        await setUserSetting(userId, LANGUAGE_KEY, lang);
      } catch (error) {
        console.error('Save language error:', error);
      }
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translate(key, language);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loadLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}