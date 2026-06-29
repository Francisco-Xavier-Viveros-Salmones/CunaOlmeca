import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzyrwnASmJAwCyTR6tNCDp5tjNePv9MBc",
  authDomain: "cunaolmeca.firebaseapp.com",
  projectId: "cunaolmeca",
  storageBucket: "cunaolmeca.firebasestorage.app",
  messagingSenderId: "867148051661",
  appId: "1:867148051661:web:8d8b68e31ac7300925a584",
  measurementId: "G-R61QY3RTY1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
