import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Adresse der Web-App: Hier landet der Link aus der Passwort-vergessen-Mail.
 *  Auch aus der Android-App wird dorthin geschickt – das Zurücksetzen läuft
 *  im Browser, danach meldet man sich in der App mit dem neuen Passwort an. */
const PWA_URL = 'https://lacoticomohd.github.io/LacoticomoHD/';

function resetRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin + window.location.pathname;
  }
  return PWA_URL;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** true, solange der Nutzer über einen Passwort-Reset-Link gekommen ist. */
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  passwordRecovery: false,
  signIn: async () => ({ error: 'nicht initialisiert' }),
  signUp: async () => ({ error: 'nicht initialisiert' }),
  resetPassword: async () => ({ error: 'nicht initialisiert' }),
  updatePassword: async () => ({ error: 'nicht initialisiert' }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Supabase meldet PASSWORD_RECOVERY, wenn der Link aus der Mail geöffnet
      // wurde. Dann zeigt die App den Bildschirm zum Setzen eines neuen Passworts.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? error.message : null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectTo(),
    });
    return { error: error ? error.message : null };
  };

  /** Setzt das neue Passwort (nach Klick auf den Link aus der Mail). */
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        passwordRecovery,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
