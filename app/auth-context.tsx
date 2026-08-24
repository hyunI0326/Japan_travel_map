"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AuthUser = {
  displayName: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AuthContextValue;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
