import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  setupSidebar();          // Handles mobile sidebar toggle
  setupProfileDropdown();  // Handles profile dropdown open/close
  setupAuthUI();           // Handles login/logout visibility
  setupUserProfileMini();  // Loads mini profile info in sidebar

});

/* =========================================================
   SIDEBAR TOGGLE
   Controls opening/closing sidebar in mobile view
   ========================================================= */

function setupSidebar() {

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");

  if (!menuBtn) return;

  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  });
}

/* =========================================================
   PROFILE DROPDOWN
   Controls dropdown under "Profile ▾"
   ========================================================= */

function setupProfileDropdown() {

  const toggle = document.getElementById("profileToggle");
  const dropdown = document.getElementById("profileDropdown");

  if (!toggle || !dropdown) return;

  toggle.addEventListener("click", () => {
    dropdown.classList.toggle("active");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("active");
    }
  });
}

/* =========================================================
   AUTH UI CONTROL
   Shows/Hides Login + Profile Dropdown
   Handles Logout
   ========================================================= */

function setupAuthUI() {

  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const profileWrapper = document.querySelector(".profile-wrapper");

  onAuthStateChanged(auth, (user) => {

    if (user) {

      if (loginLink) loginLink.style.display = "none";
      if (profileWrapper) profileWrapper.style.display = "block";

    } else {

      if (loginLink) loginLink.style.display = "block";
      if (profileWrapper) profileWrapper.style.display = "none";

    }

  });

  if (logoutLink) {

    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      window.location.href = "login.html";
    });

  }

}

/* =========================================================
   MINI PROFILE LOADER
   Loads user's name, email, avatar image or letter
   ========================================================= */

function setupUserProfileMini() {

  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const avatarLetter = document.getElementById("avatarCircle");
  const miniProfileImg = document.getElementById("miniProfileImg");

  onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    // Email
    if (profileEmail)
      profileEmail.textContent = user.email;

    // Default letter
    if (avatarLetter)
      avatarLetter.textContent = user.email[0].toUpperCase();

    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {

      const data = snap.data();

      // Set name
      if (profileName) {
        profileName.textContent =
          data.firstName
            ? data.firstName
            : user.email.split("@")[0];
      }

      // ✅ If photo exists, show image
      if (data.photoURL && miniProfileImg) {

        miniProfileImg.src = data.photoURL;
        miniProfileImg.style.display = "block";

        if (avatarLetter)
          avatarLetter.style.display = "none";

        // If image fails, fallback to letter
        miniProfileImg.onerror = () => {
          miniProfileImg.style.display = "none";
          avatarLetter.style.display = "block";
        };

      }

    } else {

      if (profileName)
        profileName.textContent =
          user.email.split("@")[0];

    }

  });

}