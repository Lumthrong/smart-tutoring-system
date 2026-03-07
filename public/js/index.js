import { db, auth } from "./firebase.js";

import {
  collection,
  onSnapshot,
  addDoc,
  where,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  const container = document.getElementById("departmentSections");
  if (!container) return;

  let currentUser = null;

  /* ================= AUTH ================= */

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });

  /* ================= COURSES ================= */

  const coursesRef = collection(db, "courses");

  onSnapshot(coursesRef, async (snapshot) => {

    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = "<p>No courses uploaded yet.</p>";
      return;
    }

    const grouped = {};

    snapshot.forEach(docSnap => {

      const data = docSnap.data();
      const dept = (data.department || "Others").trim();

      if (!grouped[dept]) grouped[dept] = [];

      grouped[dept].push({
        id: docSnap.id,
        ...data
      });

    });

    for (const dept of Object.keys(grouped)) {

      const section = document.createElement("div");
      section.className = "dept-section";

      section.innerHTML = `
        <h3 class="dept-title">${dept}</h3>
        <div class="dept-slider"></div>
      `;

      container.appendChild(section);

      const slider = section.querySelector(".dept-slider");

      for (const course of grouped[dept]) {

        let isJoined = false;

        if (currentUser) {
          const enrollQuery = query(
            collection(db, "enrollments"),
            where("userId", "==", currentUser.uid),
            where("courseId", "==", course.id)
          );

          const enrollSnap = await getDocs(enrollQuery);
          if (!enrollSnap.empty) isJoined = true;
        }

        const card = document.createElement("div");
        card.className = "book-card";

        card.innerHTML = `
          <h3>${course.course}</h3>
          <p>Semester ${course.semester}</p>

          ${isJoined ? `
            <a href="${course.pdfURL}" target="_blank" class="pdf-btn">
              View PDF
            </a>

            ${course.videoURL ? `
              <video width="100%" controls>
                <source src="${course.videoURL}">
              </video>
            ` : ""}
          ` : `
            <div class="locked">
              🔒 Join to access materials
            </div>
          `}

          <button class="join-btn">
            ${isJoined ? "Joined" : "Join Course"}
          </button>
        `;

        const joinBtn = card.querySelector(".join-btn");

        if (!isJoined) {

          joinBtn.addEventListener("click", async () => {

            const user = auth.currentUser;

            if (!user) {
              alert("Login first.");
              return;
            }

            await addDoc(collection(db, "enrollments"), {
              userId: user.uid,
              courseId: course.id,
              courseName: course.course,
              department: dept,
              joinedAt: new Date()
            });

            alert("Joined successfully!");
            location.reload();
          });

        } else {
          joinBtn.disabled = true;
        }

        slider.appendChild(card);
      }

    }

  });

});
const reveals = document.querySelectorAll(".dept-section");

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = 1;
      entry.target.style.transform = "translateY(0)";
    }
  });
}, { threshold: 0.2 });

reveals.forEach(section => observer.observe(section));