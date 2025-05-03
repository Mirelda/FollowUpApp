import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Auth ve Firestore örneklerini oluştur
const auth = getAuth(app);
const db = getFirestore(app);

// Oturum süresini 1 saat olarak ayarla
auth.settings = {
  sessionTimeoutDuration: 3600000, // 1 saat
};

// Oturum kalıcılığını ayarla
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Oturum kalıcılığı ayarlanırken hata oluştu:', error);
  });

export { auth, db }; 