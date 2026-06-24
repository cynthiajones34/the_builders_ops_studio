import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
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

function messageFor(code: string, fallback?: string) {
  const messages: Record<string, string> = {
    "auth/operation-not-allowed":
      "Google sign-in isn't enabled. In the Firebase console: Authentication → Sign-in method → Google → Enable.",
    "auth/configuration-not-found":
      "Google sign-in isn't enabled. In the Firebase console: Authentication → Sign-in method → Google → Enable.",
    "auth/unauthorized-domain":
      "This domain isn't authorized. Add it in Authentication → Settings → Authorized domains.",
    "auth/network-request-failed":
      "Network error reaching Firebase. Check your connection and try again.",
  };
  return (messages[code] ?? fallback ?? "Sign-in failed.") + (code ? `  (${code})` : "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Complete a redirect sign-in (if we're returning from Google) and enforce
    // the email allowlist on the redirected account.
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user && !isAllowed(result.user)) {
          await signOut(auth);
          setError(
            `${result.user.email} isn't authorized for this portal. Sign in with your BOS account.`
          );
        }
      })
      .catch((e: any) => {
        console.error("[auth] redirect result failed:", e?.code, e);
        setError(messageFor(e?.code ?? "", e?.message));
      });

    return unsub;
  }, []);

  // Redirect-based sign-in. Works on GitHub Pages (no popup, so the
  // Cross-Origin-Opener-Policy header can't block it).
  async function signIn() {
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (e: any) {
      console.error("[auth] sign-in failed:", e?.code, e);
      setError(messageFor(e?.code ?? "", e?.message));
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
