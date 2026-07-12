import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getSession, login as authLogin, signup as authSignup, logout as authLogout } from '../lib/auth';
import { useAppSettings } from './AppSettingsContext';
import { useLanguage } from './LanguageContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { loadSettings } = useAppSettings();
  const { loadLanguage } = useLanguage();

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const session = await getSession();
      if (session) {
        setUser(session);
        await loadSettings(session.id);
        await loadLanguage(session.id);
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const loggedUser = await authLogin(email, password);
    setUser(loggedUser);
    await loadSettings(loggedUser.id);
    await loadLanguage(loggedUser.id);
  }

  async function signup(name: string, email: string, password: string) {
    const newUser = await authSignup(name, email, password);
    setUser(newUser);
    await loadSettings(newUser.id);
    await loadLanguage(newUser.id);
  }

  async function logout() {
    await authLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}