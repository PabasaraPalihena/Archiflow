import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type User = {
  _id: string;
  name: string;
  email: string;
  location?: string;
  subscription?: {
    plan: "developer" | "professional" | "enterprise";
    upgradedAt?: string;
  };
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (token: string) => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/auth/getuser`,
        {},
        {
          headers: { "auth-token": token },
        },
      );
      setUser(res.data);
    } catch {
      // Token invalid or expired
      localStorage.removeItem("auth-token");
      setUser(null);
    }
  }, []);

  const login = useCallback(
    async (token: string) => {
      localStorage.setItem("auth-token", token);
      await fetchUser(token);
    },
    [fetchUser],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("auth-token");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("auth-token");
    if (token) {
      await fetchUser(token);
    }
  }, [fetchUser]);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem("auth-token");
    if (token) {
      fetchUser(token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const token = localStorage.getItem("auth-token");

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
