import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Конфигурация Firebase, автоматически сгенерированная платформой
const firebaseConfig = {
  apiKey: "AIzaSyBS_uM8YJsj5bM4sb_HgcjpGLgSL4EkCEY",
  authDomain: "gen-lang-client-0778799666.firebaseapp.com",
  projectId: "gen-lang-client-0778799666",
  storageBucket: "gen-lang-client-0778799666.firebasestorage.app",
  messagingSenderId: "252478585744",
  appId: "1:252478585744:web:e0761251180a1957b25115"
};

const app = initializeApp(firebaseConfig);

// Важно: инициализируем Firestore с использованием конкретного databaseId,
// который был создан в ходе провижнинга, чтобы избежать ошибок missing database.
export const db = getFirestore(app, "ai-studio-cff6ad43-3df1-42f2-956e-3ecda2c554d1");

// Экспортируем инстанс аутентификации и провайдеры
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
};
