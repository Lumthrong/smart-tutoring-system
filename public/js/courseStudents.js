import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===== GET COURSE ID ===== */
const params = new URLSearchParams(window.location.search);
const courseId = params.get("courseId");

const container = document.getElementById("studentList");

/* ===== LOADER ===== */
function showLoader() {
  container.innerHTML = `<div class="loader">Loading students...</div>`;
}

/* ===== EMPTY ===== */
function showEmpty(msg) {
  container.innerHTML = `<div class="empty">${msg}</div>`;
}

async function loadCourseTitle() {
  const title = document.getElementById("courseTitle");

  if (!courseId) {
    title.innerText = "Course";
    return;
  }

  try {
    const courseSnap = await getDoc(doc(db, "courses", courseId));

    if (courseSnap.exists()) {
      const course = courseSnap.data();
      title.innerText = `Students enrolled in: ${course.course}`;
    } else {
      title.innerText = "Course not found";
    }

  } catch (err) {
    console.error(err);
    title.innerText = "Error loading course";
  }
}
/* ===== LOAD STUDENTS ===== */
async function loadStudents() {

  if (!courseId) {
    showEmpty("No course selected");
    return;
  }

  showLoader();

  try {

    const enrollSnap = await getDocs(
      query(
        collection(db, "enrollments"),
        where("courseId", "==", courseId)
      )
    );

    if (enrollSnap.empty) {
      showEmpty("No students enrolled");
      return;
    }

    container.innerHTML = "";

    for (const e of enrollSnap.docs) {

      const userId = e.data().userId;

      const userSnap = await getDoc(doc(db, "users", userId));

      if (!userSnap.exists()) continue;

      const user = userSnap.data();

      const name =
        user.firstName ||
        user.name ||
        user.fullName ||
        "Student";

      const email = user.email || "No email";

      const div = document.createElement("div");
      div.className = "student-card";

      div.innerHTML = `
        <div>
          <div class="student-name">${name}</div>
          <div class="student-email">${email}</div>
        </div>
      `;

      container.appendChild(div);
    }

  } catch (err) {
    console.error(err);
    showEmpty("Failed to load students");
  }

}

loadCourseTitle();
loadStudents();