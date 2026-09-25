"use client";

import type { AuthUser, LoginInput, RegisterInput } from "@vista/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api/auth";
import { refreshSession, subscribeToSessionEnd } from "@/lib/auth/session";
import { setAccessToken } from "@/lib/auth/tokenStore";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth State: فقط «چه کسی وارد شده» را نگه می‌دارد. (Access Token در tokenStore است، نه State.)
 * هنگام بارگذاری، نشست با Refresh Cookie بازیابی می‌شود؛ تا آن زمان status = "loading".
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setStatus(session ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        // خطای شبکه/سرور هنگام بازیابی: کاربر را مهمان فرض می‌کنیم، Session پاک نشده و بعداً قابل تلاش است
        if (!cancelled) setStatus("unauthenticated");
      });

    // Refresh ناموفق در میانه کار (مثلاً نشست باطل شد) → بازگشت به حالت مهمان
    const unsubscribe = subscribeToSessionEnd(() => {
      setUser(null);
      setStatus("unauthenticated");
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const startSession = useCallback((session: { accessToken: string; user: AuthUser }) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (input: LoginInput) => startSession(await authApi.login(input)),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => startSession(await authApi.register(input)),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // حتی اگر درخواست شکست خورد، Session محلی پاک می‌شود (Cookie سمت سرور منقضی می‌شود)
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth باید داخل AuthProvider استفاده شود");
  }
  return context;
}
