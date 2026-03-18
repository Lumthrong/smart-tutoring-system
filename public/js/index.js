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
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= HELPERS ================= */

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

let messageTimer;
function showMessage(text) {
  const msg = document.getElementById("systemMessage");
  if (!msg) return;
  msg.innerText = text;
  msg.style.display = "block";
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { msg.style.display = "none"; }, 3000);
}

/* ================= MAIN DOM CONTENT ================= */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("departmentSections");
  const searchInput = document.getElementById("courseSearch");
  const template = document.getElementById("courseCardTemplate");
  const searchDropdown = document.getElementById("searchDropdown");
  const announcementArea = document.getElementById("announcementArea");
  const announcementContent = document.getElementById("announcementContent");
  const announcementTime = document.getElementById("announcementTime");

  // Modal Elements
  const modal = document.getElementById("joinModal");
  const courseText = document.getElementById("joinCourseName");
  const confirmBtn = document.getElementById("confirmJoin");
  const cancelBtn = document.getElementById("cancelJoin");

  let currentUser = null;
  let allCourses = [];
  let joinedCourses = new Set();
  let pendingJoin = null;

  /* 1. ANNOUNCEMENT LOGIC */
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
        announcementArea.style.display = "flex"; 
      } else {
        announcementArea.style.display = "none";
      }
    });
  }

  /* 2. JOIN MODAL LOGIC */
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.classList.remove("show");
      pendingJoin = null;
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      if (!pendingJoin || !currentUser) return;

      const { course, joinBtn, dept } = pendingJoin;
      modal.classList.remove("show");

      joinBtn.disabled = true;
      joinBtn.textContent = "Joining...";

      try {
        await addDoc(collection(db, "enrollments"), {
          userId: currentUser.uid,
          courseId: course.id,
          courseName: course.course,
          department: dept,
          joinedAt: new Date()
        });

        joinedCourses.add(course.id);
        showMessage("Successfully joined " + course.course);
        renderCourses(); // Refresh UI to show "Joined"
      } catch (error) {
        console.error("Enrollment error:", error);
        showMessage("Error joining course.");
        joinBtn.disabled = false;
        joinBtn.textContent = "Join Course";
      }
      pendingJoin = null;
    };
  }

  /* 3. AUTH LISTENER */
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      const enrollQuery = query(collection(db, "enrollments"), where("userId", "==", user.uid));
      const enrollSnap = await getDocs(enrollQuery);
      joinedCourses.clear();
      enrollSnap.forEach(doc => joinedCourses.add(doc.data().courseId));
    }
    renderCourses();
  });

  /* 4. RENDER COURSES */
  function renderCourses() {
    if (!container) return;
    container.innerHTML = "";

    if (!allCourses.length) {
      container.innerHTML = "<p>No courses uploaded yet.</p>";
      return;
    }

    const latestCourses = [...allCourses]
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 12);

    const grouped = {};
    latestCourses.forEach(course => {
      const dept = (course.department || "Others").trim().toUpperCase();
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(course);
    });

    Object.keys(grouped).forEach(dept => {
      const section = document.createElement("div");
      section.className = "dept-section";
      section.innerHTML = `
        <div class="dept-header">
          <h3 class="dept-title">${dept}</h3>
          <a class="show-more" href="department.html?dept=${encodeURIComponent(dept)}">Show More</a>
        </div>
        <div class="dept-slider"></div>
      `;
      container.appendChild(section);
      const slider = section.querySelector(".dept-slider");

      grouped[dept].forEach(course => {
        const card = template.content.cloneNode(true);
        const cover = card.querySelector(".book-cover");
        const title = card.querySelector(".course-title");
        const semester = card.querySelector(".course-semester");
        const pdfBtn = card.querySelector(".pdf-btn");
        const joinBtn = card.querySelector(".join-btn");
        const locked = card.querySelector(".locked");

        title.textContent = course.course;
        semester.textContent = "Semester " + course.semester;
        if (course.coverURL) cover.src = course.coverURL;

        if (joinedCourses.has(course.id)) {
          joinBtn.textContent = "Joined";
          joinBtn.disabled = true;
          locked.style.display = "none";
          pdfBtn.href = course.pdfURL;
        } else {
          pdfBtn.style.display = "none";
          joinBtn.onclick = () => {
            if (!currentUser) return showMessage("Please login first");
            courseText.textContent = `Join ${course.course}?`;
            pendingJoin = { course, joinBtn, dept };
            modal.classList.add("show");
          };
        }
        slider.appendChild(card);
      });
    });
    observeSections();
  }

  /* 5. DATA FETCHING */
  onSnapshot(collection(db, "courses"), (snapshot) => {
    allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCourses();
  });

  /* 6. UTILS (Search/Slider) */
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      if (!term) return (searchDropdown.style.display = "none");
      const results = allCourses.filter(c => c.course?.toLowerCase().includes(term)).slice(0, 6);
      renderSearchDropdown(results);
    });
  }

  function renderSearchDropdown(results) {
    searchDropdown.innerHTML = results.length ? "" : "<div class='search-item'>No results found</div>";
    results.forEach(course => {
      const item = document.createElement("div");
      item.className = "search-item";
      item.innerHTML = `<div><h4>${course.course}</h4><p>${course.department} • Sem ${course.semester}</p></div>`;
      item.onclick = () => window.location.href = `department.html?dept=${encodeURIComponent(course.department)}`;
      searchDropdown.appendChild(item);
    });
    searchDropdown.style.display = "block";
  }

  // Close search dropdown on click away
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) searchDropdown.style.display = "none";
  });
});

/* ================= OUTSIDE DOMContentLoaded ================= */

function observeSections() {
  const sections = document.querySelectorAll(".dept-section");
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = 1;
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, { threshold: 0.2 });
  sections.forEach(s => observer.observe(s));
}

// Hero Slider
const initHeroSlider = () => {
  const slides = document.querySelectorAll(".hero-slide");
  if (!slides.length) return;
  let index = 0;
  setInterval(() => {
    slides[index].classList.remove("active");
    index = (index + 1) % slides.length;
    slides[index].classList.add("active");
  }, 7000);
};
initHeroSlider();
