// Firebase email/password auth context. Exposes useAuth() so screens can
// read the signed-in user and call signIn/signUp/signOut. The app stays
// fully usable signed-out — nothing here gates any route or feature.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

type AuthValue = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  const value: AuthValue = {
    user,
    initializing,
    signIn: async (e, p) => {
      await signInWithEmailAndPassword(auth, e, p);
    },
    signUp: async (e, p) => {
      await createUserWithEmailAndPassword(auth, e, p);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
