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

  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const dob = document.getElementById("dob");
  const gender = document.getElementById("gender");
  const department = document.getElementById("department");

  const emailDisplay = document.getElementById("emailDisplay");
  const roleDisplay = document.getElementById("roleDisplay");

  const profilePicInput = document.getElementById("profilePicInput");
  const profilePreview = document.getElementById("profilePreview");

  const saveBtn = document.getElementById("saveProfileBtn");

  let currentUser = null;
  let cropper = null;
  let existingPhotoURL = null;
  let existingRole = null;

  /* =========================================================
     AUTH LISTENER
     Loads existing user profile data
  ========================================================= */

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    emailDisplay.value = user.email;

    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {

      const data = snap.data();

      firstName.value = data.firstName || "";
      lastName.value = data.lastName || "";
      dob.value = data.dob || "";
      gender.value = data.gender || "";
      department.value = data.department || "";
      roleDisplay.value = data.role || "user";

      existingPhotoURL = data.photoURL || null;
      existingRole = data.role;

      profilePreview.src =
        existingPhotoURL ||
        "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    }

  });

  /* =========================================================
     IMAGE PREVIEW + CROPPER
  ========================================================= */

  profilePicInput.addEventListener("change", (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {

      profilePreview.src = reader.result;

      if (cropper) cropper.destroy();

      if (window.Cropper) {
        cropper = new Cropper(profilePreview, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 1
        });
      }
    };

    reader.readAsDataURL(file);
  });

  /* =========================================================
     SAVE PROFILE
  ========================================================= */

  saveBtn.addEventListener("click", async () => {

    try {

      if (!currentUser) return;

      let photoURL = existingPhotoURL || null;
      let fileToUpload = null;

      /* ================= IMAGE UPLOAD ================= */

      if (profilePicInput.files.length > 0) {

        // Try crop first
        if (cropper) {

          const canvas = cropper.getCroppedCanvas({
            width: 400,
            height: 400
          });

          if (canvas) {

            const blob = await new Promise((resolve) =>
              canvas.toBlob(resolve, "image/jpeg", 0.9)
            );

            if (blob) {
              fileToUpload = blob;
            }
          }
        }

        // Fallback to original file if crop fails
        if (!fileToUpload) {
          fileToUpload = profilePicInput.files[0];
        }

        const formData = new FormData();
        formData.append("profile", fileToUpload);

        const res = await fetch("/upload-profile", {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          console.error("Server returned:", res.status);
          alert("Upload request failed.");
          return;
        }

        const data = await res.json();

        if (!data.success) {
          alert("Upload failed.");
          return;
        }

        photoURL = data.fileURL;
        profilePreview.src = photoURL; // Update preview immediately
      }

      /* ================= SAVE TO FIRESTORE ================= */

      await setDoc(doc(db, "users", currentUser.uid), {
        email: currentUser.email,
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        dob: dob.value,
        gender: gender.value,
        department: department.value,
        photoURL: photoURL,
        role: existingRole   // required for your security rules
      }, { merge: true });

      alert("Profile updated successfully!");

      if (cropper) {
        cropper.destroy();
        cropper = null;
      }

    } catch (err) {
      console.error("PROFILE SAVE ERROR:", err);
      alert("Profile update failed.");
    }

  });

});