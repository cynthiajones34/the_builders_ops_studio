import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, ALLOWED_EMAILS } from "./firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  authorized: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function isAllowed(user: User | null) {
  const email = user?.email?.toLowerCase();
  return !!email && ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function signIn() {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!isAllowed(result.user)) {
        await signOut(auth);
        setError(
          `${result.user.email} isn't authorized for this portal. Sign in with your BOS account.`
        );
      }
    } catch (e: any) {
      if (e?.code === "auth/popup-closed-by-user") return;
      if (e?.code === "auth/operation-not-allowed") {
        setError(
          "Google sign-in isn't enabled yet. Enable it in the Firebase console (Authentication → Sign-in method → Google)."
        );
      } else {
        setError(e?.message ?? "Sign-in failed. Try again.");
      }
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authorized: isAllowed(user),
        error,
        signIn,
        logout,
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
