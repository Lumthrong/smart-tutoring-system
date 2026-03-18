import { db, auth } from "./firebase.js";
import {
  collection,
  onSnapshot,
  addDoc,
  where,
  getDocs,
  orderBy,
  limit,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= HELPERS ================= */

/**
 * Formats a Firestore timestamp for display
 */
function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Global UI Notification/Toast
 */
let messageTimer;
function showMessage(text) {
  const msg = document.getElementById("systemMessage");
  if (!msg) return;

  msg.innerText = text;
  msg.style.display = "block";

  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    msg.style.display = "none";
  }, 3000);
}

/* ================= MAIN DOM LOGIC ================= */

document.addEventListener("DOMContentLoaded", () => {
  // Select key UI elements
  const container = document.getElementById("departmentSections");
  const startBtn = document.getElementById("getStartedBtn");
  const announcementArea = document.getElementById("announcementArea");
  const announcementContent = document.getElementById("announcementContent");
  const announcementTime = document.getElementById("announcementTime");
  
  // Join Modal Elements
  const modal = document.getElementById("joinModal");
  const courseText = document.getElementById("joinCourseName");
  const confirmBtn = document.getElementById("confirmJoin");
  const cancelBtn = document.getElementById("cancelJoin");

  let currentUser = null;
  let pendingJoin = null; // Stores data for the course currently being joined

  /* 1. REAL-TIME ANNOUNCEMENTS */
  if (announcementArea) {
    const q = query(
      collection(db, "notifications"),
      where("type", "==", "global"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        announcementContent.innerText = data.message;
        announcementTime.innerText = formatTime(data.createdAt);
        announcementArea.style.display = "block";
      } else {
        announcementArea.style.display = "none";
      }
    });
  }

  /* 2. AUTHENTICATION LISTENER */
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    // You could trigger a re-render of courses here if you want to 
    // update "Join" buttons to "Joined" based on user status.
  });

  /* 3. HERO SECTION INTERACTION */
  if (startBtn) {
    startBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById("recentUploads");
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* 4. MODAL & ENROLLMENT LOGIC */
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.classList.remove("show");
      pendingJoin = null;
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      if (!pendingJoin || !currentUser) return;

      const { course, joinBtn } = pendingJoin;
      modal.classList.remove("show");

      // UI Feedback
      joinBtn.disabled = true;
      joinBtn.textContent = "Joining...";

      try {
        await addDoc(collection(db, "enrollments"), {
          userId: currentUser.uid,
          courseId: course.id,
          courseName: course.course,
          department: course.department || "General",
          joinedAt: new Date()
        });

        showMessage("Successfully joined " + course.course);
        joinBtn.textContent = "Joined";
      } catch (error) {
        console.error("Enrollment error:", error);
        showMessage("Error joining course. Please try again.");
        joinBtn.disabled = false;
        joinBtn.textContent = "Join Course";
      }

      pendingJoin = null;
    };
  }

  /* 5. INITIALIZE SCROLL REVEAL */
  const observeSections = () => {
    const sections = document.querySelectorAll(".dept-section");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = 1;
          entry.target.style.transform = "translateY(0)";
        }
      });
    }, { threshold: 0.1 });

    sections.forEach((s) => observer.observe(s));
  };
  
  observeSections();
});

/* ================= HERO SLIDER ================= */
// This runs globally to ensure the slider starts immediately
const initSlider = () => {
  const slides = document.querySelectorAll(".hero-slide");
  if (slides.length === 0) return;

  let slideIndex = 0;
  setInterval(() => {
    slides[slideIndex].classList.remove("active");
    slideIndex = (slideIndex + 1) % slides.length;
    slides[slideIndex].classList.add("active");
  }, 5000);
};

initSlider();