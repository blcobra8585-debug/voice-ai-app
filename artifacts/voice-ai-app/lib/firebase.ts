import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyAy83WHOCsyig7_c19xWVOW7spXvNbFA44',
  authDomain: 'voice-changer-f8df7.firebaseapp.com',
  projectId: 'voice-changer-f8df7',
  storageBucket: 'voice-changer-f8df7.firebasestorage.app',
  messagingSenderId: '735117645262',
  appId: '1:735117645262:android:a3510c9906bc74ea66079f',
};

let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
} catch {
  db = getFirestore(app);
}

export { app, db };
