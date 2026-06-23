import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Public web config for the-builders-ops-studio Firebase project.
// The apiKey is NOT a secret (Firebase web keys identify the project, they
// don't grant access). Access is enforced by Auth + Firestore security rules.
const firebaseConfig = {
  apiKey: "AIzaSyA08Qy111uZFAT6KchR6h1Y98QAUTYlb3w",
  authDomain: "the-builders-ops-studio.firebaseapp.com",
  projectId: "the-builders-ops-studio",
  storageBucket: "the-builders-ops-studio.firebasestorage.app",
  messagingSenderId: "752847644380",
  appId: "1:752847644380:web:8adc744858726992a4b619",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

// Only these accounts may use the portal. Client-side gate for UX; real
// enforcement lives in Firestore security rules (Phase 2 data layer).
export const ALLOWED_EMAILS = [
  "cynthia@thebuildersopsstudio.com",
  "cynthiajones34@gmail.com",
];
