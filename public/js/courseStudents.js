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
const semester = params.get("semester");

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

  const title =
    document.getElementById("courseTitle");

  if (!courseId) {

    title.innerText = "Course";
    return;

  }

  try {

const subjectQuery =
  await getDocs(
    query(
      collection(db, "subjects"),
      where(
        "subjectName",
        "==",
        courseId
      )
    )
  );

if (!subjectQuery.empty) {

  const subject =
    subjectQuery.docs[0].data();

  title.innerText =
    `Students enrolled in: ${subject.subjectName}`;

} else {

  title.innerText =
    courseId;

}

  } catch (err) {

    console.error(err);

    title.innerText =
      "Error loading course";

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

if (!semester) {
  showEmpty("No semester assigned");
  return;
}

    const studentSnap =
      await getDocs(
        query(
          collection(
            db,
            "student_master"
          ),
          where(
            "semester",
            "==",
            semester
          )
        )
      );

    if (studentSnap.empty) {
      showEmpty("No students found");
      return;
    }

    container.innerHTML = "";

    studentSnap.forEach(docSnap => {

      const student =
        docSnap.data();

      const div =
        document.createElement("div");

      div.className =
        "student-card";

      div.innerHTML = `
        <div>
          <div class="student-name">
            ${student.name || "Student"}
          </div>

          <div class="student-email">
            ${student.email || ""}
          </div>
        </div>
      `;

      container.appendChild(div);

    });

  } catch (err) {

    console.error(err);
    showEmpty("Failed to load students");

  }

}
loadCourseTitle();
loadStudents();