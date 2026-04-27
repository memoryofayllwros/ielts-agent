import React, { createContext, useContext, useState, useCallback } from "react";
import { loginUser, registerUser } from "services/api";

const AuthContext = createContext(null);
const SESSION_KEY = "ielts_auth_session";

function getStoredSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (raw && typeof raw.access_token === "string" && raw.access_token.length > 0) {
      return raw;
    }
    if (raw) localStorage.removeItem(SESSION_KEY);
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredSession());

  const login = useCallback(async (email, password) => {
    const session = await loginUser(email, password);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const register = useCallback(async (email, password) => {
    const session = await registerUser(email, password);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  /** Merge server profile fields (and any partial session fields) into stored session. */
  const mergeSession = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        mergeSession,
        isAuthenticated: !!(user && typeof user.access_token === "string" && user.access_token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
