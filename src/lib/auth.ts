import * as SecureStore from 'expo-secure-store';
import { createUser, getUserByEmail } from './database';

const SESSION_KEY = 'user_session';

export interface User {
  id: number;
  name: string;
  email: string;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash)}_${password.length}`;
}

export async function signup(name: string, email: string, password: string): Promise<User> {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }
  
  const hashedPassword = hashPassword(password);
  const userId = await createUser(name, email, hashedPassword);
  
  const user: User = { id: userId, name, email };
  await setSession(user);
  
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  const hashedPassword = hashPassword(password);
  if (user.password !== hashedPassword) {
    throw new Error('Invalid email or password');
  }
  
  const sessionUser: User = { id: user.id, name: user.name, email: user.email };
  await setSession(sessionUser);
  
  return sessionUser;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getSession(): Promise<User | null> {
  try {
    const session = await SecureStore.getItemAsync(SESSION_KEY);
    if (!session) return null;
    return JSON.parse(session);
  } catch {
    return null;
  }
}

async function setSession(user: User): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
}
