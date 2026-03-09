import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* ================= GET DEPARTMENT ================= */

const params = new URLSearchParams(window.location.search);
const department = params.get("dept");

document.getElementById("deptTitle").innerText = department + " Courses";


/* ================= ELEMENTS ================= */

const container = document.getElementById("deptCourses");
const searchInput = document.getElementById("courseSearch");


/* ================= STORE COURSES ================= */

let allCourses = [];
let joinedCourses = new Set();


/* ================= LOAD COURSES ================= */

const coursesRef = query(
  collection(db, "courses"),
  where("department", "==", department)
);


/* ================= FETCH ENROLLMENTS ================= */

async function loadEnrollments() {

  const user = auth.currentUser;

  if (!user) return;

  const enrollSnap = await getDocs(
    query(collection(db, "enrollments"), where("userId", "==", user.uid))
  );

  enrollSnap.forEach(doc => {
    joinedCourses.add(doc.data().courseId);
  });

}


/* ================= RENDER COURSES ================= */

function renderCourses(filter = "") {

  container.innerHTML = "";

  const filtered = allCourses.filter(course =>
    course.course.toLowerCase().includes(filter)
  );

  if (!filtered.length) {
    container.innerHTML = "<p>No courses found.</p>";
    return;
  }

  filtered.forEach(course => {

    const isJoined = joinedCourses.has(course.id);

    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <h3>${course.course}</h3>
      <p>Semester ${course.semester}</p>

      ${isJoined ? `
        <a href="${course.pdfURL}" target="_blank">View PDF</a>
      ` : `
        <div class="locked">🔒 Join to access materials</div>
      `}

      <button class="j-btn">
        ${isJoined ? "Joined" : "Join Course"}
      </button>
    `;

    const joinBtn = card.querySelector(".j-btn");

    if (!isJoined) {

      joinBtn.addEventListener("click", async () => {

        const confirmJoin = confirm(`Join ${course.course}?`);
        if (!confirmJoin) return;

        await addDoc(collection(db, "enrollments"), {
          userId: auth.currentUser.uid,
          courseId: course.id,
          courseName: course.course,
          department,
          joinedAt: new Date()
        });

        alert("Joined successfully!");

      });

    } else {
      joinBtn.disabled = true;
    }

    container.appendChild(card);

  });

}


/* ================= FIRESTORE LISTENER ================= */

onSnapshot(coursesRef, async (snapshot) => {

  allCourses = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  await loadEnrollments();

  renderCourses();

});


/* ================= SEARCH ================= */

searchInput.addEventListener("input", (e) => {

  const term = e.target.value.toLowerCase();

  renderCourses(term);

});