"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "developer" | "viewer";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: string[]) => boolean;
  canEdit: boolean;
  canScan: boolean;
  canChat: boolean;
  isAdmin: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  hasRole: () => false,
  canEdit: false,
  canScan: false,
  canChat: false,
  isAdmin: false,
  authFetch: async () => new Response(),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("strix_token");
    const savedUser = localStorage.getItem("strix_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Invalid user data, clear it
        localStorage.removeItem("strix_token");
        localStorage.removeItem("strix_user");
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("strix_token", newToken);
    localStorage.setItem("strix_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("strix_token");
    localStorage.removeItem("strix_user");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  const hasRole = (...roles: string[]) => (user ? roles.includes(user.role) : false);

  // Wrapper around fetch that adds Authorization header and handles 401/403
  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (!headers["Content-Type"] && options.body && typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      logout();
      return res;
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        hasRole,
        canEdit: hasRole("admin", "developer"),
        canScan: hasRole("admin", "developer"),
        canChat: hasRole("admin", "developer"),
        isAdmin: hasRole("admin"),
        authFetch,
      }}
    >
      {loading ? null : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
