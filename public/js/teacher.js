import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let activeCourseId = null;
let performanceChart = null;

function showMessage(text) {

  const msg = document.getElementById("systemMessage");

  msg.innerText = text;
  msg.style.display = "block";

  setTimeout(() => {
    msg.style.display = "none";
  }, 3000);

}

document.addEventListener("DOMContentLoaded", () => {

  const uploadForm = document.getElementById("uploadLectureForm");
  const courseContainer = document.getElementById("myLectures");
  const quizContainer = document.getElementById("teacherQuizzes");

  const chatBox = document.getElementById("chatBox");
  const closeBtn = document.getElementById("chatClose");
  const sendBtn = document.querySelector(".sendComment");
  const input = document.querySelector(".commentInput");

  /* AUTH */

  onAuthStateChanged(auth, user => {

    if (!user) {

      window.location = "login.html";
      return;

    }

    loadMyCourses();
    loadMyQuizzes();

    loadEnrolledCourses();
    loadEnrollmentStats();
    loadCourseDropdown();
    loadQuizResults();

  });

  /* CHAT CLOSE */

  if (closeBtn && chatBox) {

    closeBtn.onclick = () => {

      chatBox.classList.add("hidden");

    };

  }

  /* SEND COMMENT */

  if (sendBtn && input) {

    sendBtn.onclick = async () => {

      if (!activeCourseId) {

        alert("Open a course discussion first.");
        return;

      }

      const message = input.value.trim();
      if (!message) return;

      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const user = userDoc.data();

      await addDoc(collection(db, "course_comments"), {

        courseId: activeCourseId,
        userId: auth.currentUser.uid,
        userName: user.firstName || user.email,
        message: message,
        createdAt: new Date()

      });

      input.value = "";

    };

  }

  /* UPLOAD COURSE */

  if (uploadForm) {

    uploadForm.addEventListener("submit", async (e) => {

      e.preventDefault();

      const btn = document.getElementById("uploadBtn");

      btn.classList.add("loading");
      btn.disabled = true;

      const formData = new FormData(uploadForm);

      const res = await fetch("/upload", {

        method: "POST",
        body: formData

      });

      const data = await res.json();

      await addDoc(collection(db, "courses"), {

        department: data.department,
        semester: data.semester,
        course: data.course,

        pdfURL: data.pdfURL,
        videoURL: data.videoURL,

        uploadedBy: auth.currentUser.uid,
        createdAt: new Date()

      });

      btn.classList.remove("loading");
      btn.disabled = false;

      showMessage("Lecture uploaded successfully");

      uploadForm.reset();

    });

  }

  /* MY COURSES */
  function loadMyCourses() {

    const q = query(
      collection(db, "courses"),
      where("uploadedBy", "==", auth.currentUser.uid)
    );

    onSnapshot(q, (snapshot) => {

      courseContainer.innerHTML = "";

      const grouped = {};

      snapshot.forEach(docSnap => {

        const course = docSnap.data();
        const dept = course.department || "Others";

        if (!grouped[dept]) grouped[dept] = [];

        grouped[dept].push({
          id: docSnap.id,
          ...course
        });

      });

      for (const dept in grouped) {

        const section = document.createElement("div");
        section.className = "dept-section";

        section.innerHTML = `
<h4 class="dept-title">${dept}</h4>
<div class="dept-courses"></div>
`;

        courseContainer.appendChild(section);

        const grid = section.querySelector(".dept-courses");

        grouped[dept].forEach(course => {

          const courseId = course.id;

          const div = document.createElement("div");

          div.className = "lecture-card";

          div.innerHTML = `
<p>
<strong>${course.course}</strong><br>
<small>${course.semester === "general" ? "General" : `Semester ${course.semester}`}</small>
</p>

<button class="openDiscussion">Discussion</button>
<button class="createQuiz">Create Quiz</button>
<button class="latestQuiz">Latest Quiz</button>
<button class="deleteCourse">Delete</button>
`;

          div.querySelector(".openDiscussion").onclick = () => {

            activeCourseId = courseId;

            loadComments(courseId);

            chatBox.classList.remove("hidden");

            chatBox.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });

          };

          div.querySelector(".createQuiz").onclick = () => {
            window.location = "createQuiz.html?course=" + courseId;
          };

          div.querySelector(".latestQuiz").onclick = async () => {

            const snap = await getDocs(
              query(collection(db, "quizzes"),
                where("courseId", "==", courseId))
            );

            if (snap.empty) {

              alert("No quiz created yet for this course.");

              return;

            }

            window.location = "quizResults.html?course=" + courseId;

          };

          div.querySelector(".deleteCourse").onclick = async () => {

            if (!confirm("Delete this course?")) return;

            await deleteDoc(doc(db, "courses", courseId));

          };

          grid.appendChild(div);

        });

      }

    });

  }

  /* ENROLLED COURSES */

  async function loadEnrolledCourses() {

    const container = document.getElementById("enrolledCourses");

    const snap = await getDocs(

      query(collection(db, "enrollments"),
        where("userId", "==", auth.currentUser.uid))

    );

    container.innerHTML = "";

    for (const e of snap.docs) {

      const courseDoc = await getDoc(doc(db, "courses", e.data().courseId));
      if (!courseDoc.exists()) continue;

      const course = courseDoc.data();

      const div = document.createElement("div");

      div.innerHTML = `
<strong>${course.course}</strong>
<br>
<a href="${course.pdfURL}" target="_blank">Open PDF</a>
`;

      container.appendChild(div);

    }

  }

  /* ENROLLMENT STATS */

  async function loadEnrollmentStats() {

    const container = document.getElementById("enrollmentStats");

    const courseSnap = await getDocs(

      query(collection(db, "courses"),
        where("uploadedBy", "==", auth.currentUser.uid))

    );

    container.innerHTML = "";

    for (const c of courseSnap.docs) {

      const enrollSnap = await getDocs(

        query(collection(db, "enrollments"),
          where("courseId", "==", c.id))

      );

      const div = document.createElement("div");

div.className = "enrollment-card";

div.innerHTML = `
<div>
  <div class="enrollment-course">${c.data().course}</div>
  <div class="enrollment-label">Students Enrolled</div>
</div>

<div class="enrollment-count">${enrollSnap.size}</div>
`;

      container.appendChild(div);

    }

  }

  /* COURSE DROPDOWN */

  async function loadCourseDropdown() {

    const select = document.getElementById("courseSelect");

    const snap = await getDocs(

      query(collection(db, "courses"),
        where("uploadedBy", "==", auth.currentUser.uid))

    );

    select.innerHTML = "<option>Select Course</option>";

    snap.forEach(doc => {

      const opt = document.createElement("option");

      opt.value = doc.id;
      opt.textContent = doc.data().course;

      select.appendChild(opt);

    });

    select.addEventListener("change", (e) => {

      loadStudentPerformance(e.target.value);

    });

  }

  /* STUDENT PERFORMANCE */

  async function loadStudentPerformance(courseId) {

    const container = document.getElementById("performanceList");

    const snap = await getDocs(
      query(collection(db, "course_quiz_results"),
        where("courseId", "==", courseId))
    );

    container.innerHTML = "";

    let scores = [];
    let names = [];

    snap.forEach(doc => {

      const data = doc.data();

      scores.push(data.score);
      names.push(data.studentName);

      const div = document.createElement("div");

      div.innerHTML = `
<strong>${data.studentName}</strong>
<p>${data.score}%</p>
`;

      container.appendChild(div);

    });

    renderPerformanceChart(names, scores);

  }

  function renderPerformanceChart(names, scores) {

    const ctx = document.getElementById("performanceChart");

    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(ctx, {

      type: "bar",

      data: {
        labels: names,
        datasets: [{
          label: "Student Performance %",
          data: scores,
          backgroundColor: "#4f46e5"
        }]
      },

      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }

    });

  }

  /* COMMENTS */

  function loadComments(courseId) {

    const list = document.querySelector(".commentList");

    const q = query(

      collection(db, "course_comments"),
      where("courseId", "==", courseId),
      orderBy("createdAt", "asc")

    );

    onSnapshot(q, (snap) => {

      list.innerHTML = "";

      snap.forEach(docSnap => {

        const data = docSnap.data();

        const div = document.createElement("div");

        div.className = "chatMsg";

        div.innerHTML = `
<strong>${data.userName}</strong>
<p>${data.message}</p>
`;

        list.appendChild(div);

      });

      list.scrollTop = list.scrollHeight;

    });

  }

  /* QUIZ RESULTS */

async function loadQuizResults() {

  const container = document.getElementById("quizResults");

  const snap = await getDocs(collection(db, "course_quiz_results"));

  container.innerHTML = "";

  if (snap.empty) {
    container.innerHTML = "<p>No results yet.</p>";
    return;
  }

  for (const resultDoc of snap.docs) {

    const data = resultDoc.data();

    let studentName = "Unknown Student";
    let courseName = "Unknown Course";
    let submitTime = "Unknown time";

    /* FETCH STUDENT NAME */

    if (data.userId) {

      try {

        const userSnap = await getDoc(doc(db, "users", data.userId));

        if (userSnap.exists()) {

          const user = userSnap.data();

          studentName =
            user.firstName ||
            user.name ||
            user.fullName ||
            user.email ||
            "Student";

        }

      } catch (err) {
        console.error("User fetch error:", err);
      }
    }

    /* FETCH COURSE NAME FROM ENROLLMENTS */

    if (data.userId) {

      try {

        const enrollSnap = await getDocs(
          query(
            collection(db, "enrollments"),
            where("userId", "==", data.userId)
          )
        );

        if (!enrollSnap.empty) {

          const enrollment = enrollSnap.docs[0].data();

          const courseSnap = await getDoc(
            doc(db, "courses", enrollment.courseId)
          );

          if (courseSnap.exists()) {

            courseName = courseSnap.data().course;

          }

        }

      } catch (err) {
        console.error("Enrollment fetch error:", err);
      }
    }

    /* FORMAT SUBMISSION TIME */

    if (data.submittedAt) {

      const date = data.submittedAt.toDate();

      submitTime = date.toLocaleString();

    }

    const div = document.createElement("div");

    div.innerHTML = `
      <strong>${studentName}</strong>
      <p>Course: ${courseName}</p>
      <p>Score: ${data.score}</p>
      <p>Submitted: ${submitTime}</p>
      <hr>
    `;

    container.appendChild(div);

  }

}

  /* QUIZZES */

  function loadMyQuizzes() {

    const q = query(
      collection(db, "quizzes"),
      where("createdBy", "==", auth.currentUser.uid)
    );

    onSnapshot(q, async (snapshot) => {

      quizContainer.innerHTML = "";

      if (snapshot.empty) {
        quizContainer.innerHTML = "<p>No quizzes created yet.</p>";
        return;
      }

      for (const quizDoc of snapshot.docs) {

        const quiz = quizDoc.data();

        let courseName = "Unknown Course";

        if (quiz.courseId) {
          const courseDoc = await getDoc(doc(db, "courses", quiz.courseId));
          if (courseDoc.exists()) {
            courseName = courseDoc.data().course;
          }
        }

        const div = document.createElement("div");

        div.innerHTML = `
<p>
📝 <strong>${quiz.title}</strong><br>
<small>Course: ${courseName}</small>
</p>

<button class="editQuiz">Edit</button>
<button class="deleteQuiz">Delete</button>

<hr>
`;

        div.querySelector(".editQuiz").onclick = () => {
          window.location = "createQuiz.html?quiz=" + quizDoc.id;
        };

        div.querySelector(".deleteQuiz").onclick = async () => {

          if (!confirm("Delete this quiz?")) return;

          try {

            const questionQuery = query(
              collection(db, "quiz_questions"),
              where("quizId", "==", quizDoc.id)
            );

            const questions = await getDocs(questionQuery);

            for (const q of questions.docs) {
              await deleteDoc(q.ref);
            }

            const resultQuery = query(
              collection(db, "quiz_results"),
              where("quizId", "==", quizDoc.id)
            );

            const results = await getDocs(resultQuery);

            for (const r of results.docs) {
              await deleteDoc(r.ref);
            }

            await deleteDoc(doc(db, "quizzes", quizDoc.id));

            showMessage("Quiz deleted");

          } catch (err) {
            console.error(err);
            showMessage("Delete failed");
          }

        };

        quizContainer.appendChild(div);

      }

    });

  }

});