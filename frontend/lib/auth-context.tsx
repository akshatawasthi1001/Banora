"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiRequestError, apiGet, apiPost } from "./api/client";
import type { LoginResponse, User } from "./api/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "banora_access_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshUser(): Promise<User | null> {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const currentUser = await apiGet<User>("/auth/me");
      setUser(currentUser);
      setError(null);
      return currentUser;
    } catch (requestError) {
      window.localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      if (requestError instanceof ApiRequestError && requestError.status !== 401) {
        setError(requestError.detail);
      }
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeSession() {
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const currentUser = await apiGet<User>("/auth/me");
        if (!cancelled) {
          setUser(currentUser);
          setError(null);
        }
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void initializeSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<User> {
    setError(null);
    const response = await apiPost<LoginResponse>("/auth/login", { email, password });
    window.localStorage.setItem(TOKEN_KEY, response.access_token);
    const currentUser = await refreshUser();
    if (!currentUser) {
      throw new Error("We could not verify your account. Please try again.");
    }
    if (currentUser.role !== "CONTRACTOR") {
      window.localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      throw new Error("The contractor dashboard is only available to contractor accounts.");
    }
    return currentUser;
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setError(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function useRequireContractor() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && (!auth.user || auth.user.role !== "CONTRACTOR")) {
      router.replace("/login");
    }
  }, [auth.isLoading, auth.user, router]);

  return auth;
}
