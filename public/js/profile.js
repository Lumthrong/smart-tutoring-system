import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const avatarCircle = document.getElementById("avatarCircle");

  let currentUser = null;

  /* ================= AUTH LISTENER ================= */

  onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    currentUser = user;

    // Show basic info immediately
    if (profileEmail)
      profileEmail.textContent = user.email;

    if (avatarCircle)
      avatarCircle.textContent = user.email[0].toUpperCase();

    // Fetch additional profile info from Firestore
    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {

      const data = snap.data();

      if (profileName)
        profileName.textContent = data.name || user.email.split("@")[0];

    } else {

      // If no profile document exists
      if (profileName)
        profileName.textContent = user.email.split("@")[0];

    }

  });

});