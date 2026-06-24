import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  type User,
} from "firebase/auth";
import { auth, ALLOWED_EMAILS } from "./firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  authorized: boolean;
  error: string | null;
  linkSentTo: string | null;
  sendLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "bos_emailForSignIn";

function isAllowedEmail(email: string | null | undefined) {
  const e = email?.toLowerCase();
  return !!e && ALLOWED_EMAILS.map((x) => x.toLowerCase()).includes(e);
}

function messageFor(code: string, fallback?: string) {
  const messages: Record<string, string> = {
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/missing-email": "Enter your email to get a sign-in link.",
    "auth/operation-not-allowed":
      "Email-link sign-in isn't enabled in the Firebase console (Authentication → Sign-in method → Email/Password → Email link).",
    "auth/unauthorized-continue-uri":
      "This domain isn't authorized in Firebase (Authentication → Settings → Authorized domains).",
    "auth/invalid-action-code":
      "This sign-in link has expired or was already used. Request a fresh one.",
    "auth/network-request-failed":
      "Network error reaching Firebase. Check your connection and try again.",
  };
  return (messages[code] ?? fallback ?? "Sign-in failed.") + (code ? `  (${code})` : "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // If we arrived via the email sign-in link, complete sign-in. This is
    // same-origin (no popup, no third-party cookies), so it works on GitHub
    // Pages and in incognito.
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem(STORAGE_KEY);
      if (!email) {
        setError(
          "Open the sign-in link in the same browser where you requested it, or request a new one here."
        );
      } else {
        setLoading(true);
        signInWithEmailLink(auth, email, window.location.href)
          .then(async (result) => {
            window.localStorage.removeItem(STORAGE_KEY);
            // Strip the oobCode params from the URL so a refresh doesn't reuse them.
            window.history.replaceState({}, document.title, "/admin/");
            if (!isAllowedEmail(result.user.email)) {
              await signOut(auth);
              setError(
                `${result.user.email} isn't authorized for this portal.`
              );
            }
          })
          .catch((e: any) => {
            console.error("[auth] email-link sign-in failed:", e?.code, e);
            setError(messageFor(e?.code ?? "", e?.message));
            setLoading(false);
          });
      }
    }

    return unsub;
  }, []);

  async function sendLink(email: string) {
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!isAllowedEmail(clean)) {
      setError(`${email || "That account"} isn't authorized for this portal.`);
      return;
    }
    try {
      await sendSignInLinkToEmail(auth, clean, {
        url: `${window.location.origin}/admin/`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(STORAGE_KEY, clean);
      setLinkSentTo(clean);
    } catch (e: any) {
      console.error("[auth] sendSignInLink failed:", e?.code, e);
      setError(messageFor(e?.code ?? "", e?.message));
    }
  }

  async function logout() {
    await signOut(auth);
    setLinkSentTo(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authorized: isAllowedEmail(user?.email),
        error,
        linkSentTo,
        sendLink,
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
