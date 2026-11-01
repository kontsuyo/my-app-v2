"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest, onSessionExpired } from "@/lib/api-client";
import {
  clearAuthTokens,
  getAccessToken,
  setAuthTokens,
  type AuthTokens,
} from "@/lib/auth-tokens";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
};

type AuthContextValue = AuthState & {
  login: (tokens: AuthTokens) => void;
  logout: () => void;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
  });
  // 古い本人確認の応答が、ログイン・ログアウト後の状態を上書きしないための世代番号。
  const generation = useRef(0);

  const loadUser = useCallback(() => {
    const current = ++generation.current;
    const isStale = () => current !== generation.current;

    if (!getAccessToken()) {
      setState({ status: "unauthenticated", user: null });
      return;
    }

    setState({ status: "loading", user: null });
    apiRequest<AuthUser>("auth/me/")
      .then((user) => {
        if (!isStale()) setState({ status: "authenticated", user });
      })
      .catch((error: unknown) => {
        if (isStale()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearAuthTokens();
          setState({ status: "unauthenticated", user: null });
        } else {
          setState({ status: "error", user: null });
        }
      });
  }, []);

  const login = useCallback(
    (tokens: AuthTokens) => {
      setAuthTokens(tokens);
      loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(() => {
    generation.current += 1;
    clearAuthTokens();
    setState({ status: "unauthenticated", user: null });
  }, []);

  useEffect(() => {
    loadUser();
    const unsubscribe = onSessionExpired(() => {
      generation.current += 1;
      setState({ status: "unauthenticated", user: null });
    });

    return () => {
      generation.current += 1;
      unsubscribe();
    };
  }, [loadUser]);

  const value = useMemo(
    () => ({ ...state, login, logout, retry: loadUser }),
    [state, login, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
