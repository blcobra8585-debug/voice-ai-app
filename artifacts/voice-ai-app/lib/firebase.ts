import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7fSAoIOBZy44K0TET_pkQB8qK7_z1nfI",
  authDomain: "voice-changer-d5266.firebaseapp.com",
  projectId: "voice-changer-d5266",
  storageBucket: "voice-changer-d5266.firebasestorage.app",
  messagingSenderId: "627241906810",
  appId: "1:627241906810:android:c42d7aa506c051c97f81c3",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch {
  db = getFirestore(app);
}

export { app, db };
