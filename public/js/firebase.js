import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBioUbnLNzD__EeISjgVvCjmKBBDTow2lQ",
  authDomain: "sts-system-e992b.firebaseapp.com",
  projectId: "sts-system-e992b",
  storageBucket: "sts-system-e992b.firebasestorage.app",
  messagingSenderId: "576014090255",
  appId: "1:576014090255:web:1863c938a0a0626bada37a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export only what you use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

