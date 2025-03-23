import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDUgdjQ0vMYAklXY3khT_lN7eE0PoYM1PA",
  authDomain: "tablematch-ff1c4.firebaseapp.com",
  projectId: "tablematch-ff1c4",
  storageBucket: "tablematch-ff1c4.appspot.com",
  messagingSenderId: "290393323042",
  appId: "1:290393323042:android:bd8fee7856f3f82bc5fc7b",
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };