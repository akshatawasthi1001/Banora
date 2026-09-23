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
      // Only a definitive 401 means the token is no longer valid; transient
      // failures (network errors, 5xx) must not log the user out.
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
      } else if (!(requestError instanceof ApiRequestError)) {
        // Network/backend unavailable: keep the token so a retry can recover.
      }
      setUser(null);

      if (
        requestError instanceof ApiRequestError &&
        requestError.status !== 401
      ) {
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
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await apiGet<User>("/auth/me");

        if (!cancelled) {
          setUser(currentUser);
          setError(null);
        }
      } catch (requestError) {
        // Clear the stored token only when the backend confirms it is invalid
        // (401). Transient errors keep the token so refresh can recover.
        const isInvalidToken =
          requestError instanceof ApiRequestError &&
          requestError.status === 401;

        if (isInvalidToken) {
          window.localStorage.removeItem(TOKEN_KEY);
        }

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<User> {
    setError(null);

    const response = await apiPost<LoginResponse>("/auth/login", {
      email,
      password,
    });

    window.localStorage.setItem(TOKEN_KEY, response.access_token);

    const currentUser = await refreshUser();

    if (!currentUser) {
      throw new Error("We could not verify your account. Please try again.");
    }

    return currentUser;
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        refreshUser,
      }}
    >
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
    if (auth.isLoading) {
      return;
    }

    if (!auth.user) {
      router.replace("/login");
    } else if (auth.user.role !== "CONTRACTOR") {
      // Wrong role: send the user to their own workspace instead of login.
      router.replace("/dashboard/inquiries");
    }
  }, [auth.isLoading, auth.user, router]);

  return {
    ...auth,
    hasAccess: !auth.isLoading && !!auth.user && auth.user.role === "CONTRACTOR",
  };
}

export function useRequireClient() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    if (!auth.user) {
      router.replace("/login");
    } else if (auth.user.role !== "CLIENT") {
      // Wrong role: send the user to their own workspace instead of login.
      router.replace("/dashboard");
    }
  }, [auth.isLoading, auth.user, router]);

  return {
    ...auth,
    hasAccess: !auth.isLoading && !!auth.user && auth.user.role === "CLIENT",
  };
}