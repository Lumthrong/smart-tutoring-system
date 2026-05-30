import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  setDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
function confirmDelete(message) {

  return new Promise(resolve => {

    const modal = document.getElementById("confirmModal");
    const text = document.getElementById("confirmMessage");
    const ok = document.getElementById("confirmOk");
    const cancel = document.getElementById("confirmCancel");

    text.innerText = message;

    modal.classList.remove("hidden");

    ok.onclick = () => {
      modal.classList.add("hidden");
      resolve(true);
    };

    cancel.onclick = () => {
      modal.classList.add("hidden");
      resolve(false);
    };

  });

}
let activeCourseId = null;
let performanceChart = null;
let generatedQuestions = [];
let assignedSubjects = [];

function showMessage(text) {

  const msg = document.getElementById("systemMessage");

  msg.innerText = text;
  msg.style.display = "block";

  setTimeout(() => {
    msg.style.display = "none";
  }, 3000);

}
document.addEventListener("DOMContentLoaded", () => {
/* ===== ENROLLMENT TOGGLE ===== */

const enrollToggle = document.getElementById("enrollToggle");
const enrollmentStats = document.getElementById("enrollmentStats");

if(enrollToggle && enrollmentStats){
 enrollToggle.onclick = () => {

  const isOpen = enrollmentStats.classList.toggle("show");

enrollToggle.innerHTML = isOpen
  ? `<span class="material-symbols-outlined">school</span> Total Enrollment ▴`
  : `<span class="material-symbols-outlined">school</span> Total Enrollment ▾`;
};
}
  /* ===== UPLOAD DROPDOWN TOGGLE ===== */
const toggleBtn = document.getElementById("uploadToggleBtn");
const dropdown = document.getElementById("uploadDropdown");
const closeUpload = document.getElementById("closeUpload");

if(toggleBtn && dropdown){
  toggleBtn.onclick = () => {
    dropdown.classList.toggle("hidden");
  };
}

if(closeUpload){
  closeUpload.onclick = () => {
    dropdown.classList.add("hidden");
  };
}

  const uploadForm = document.getElementById("uploadLectureForm");
  const courseContainer = document.getElementById("myLectures");
  const quizContainer = document.getElementById("teacherQuizzes");

  const chatBox = document.getElementById("chatBox");
  const closeBtn = document.getElementById("chatClose");
  const sendBtn = document.querySelector(".sendComment");
  const input = document.querySelector(".commentInput");

  /* ===== FILE INPUT PREVIEW ===== */

const coverInput = document.getElementById("coverInput");
const pdfInput = document.getElementById("pdfInput");
const videoInput = document.getElementById("videoInput");

const coverPreview = document.getElementById("coverPreview");
const pdfPreview = document.getElementById("pdfPreview");
const videoPreview = document.getElementById("videoPreview");

/* COVER PREVIEW */

if(coverInput){
coverInput.onchange = () => {

const file = coverInput.files[0];
if(!file) return;

const reader = new FileReader();

reader.onload = e => {

coverPreview.innerHTML =
`<img src="${e.target.result}">`;

coverPreview.classList.add("ready");

};

reader.readAsDataURL(file);

};
}

/* PDF PREVIEW */

if(pdfInput){
pdfInput.onchange = () => {

const file = pdfInput.files[0];
if(!file) return;

pdfPreview.innerHTML =
`📄 ${file.name}`;

pdfPreview.classList.add("ready");

};
}

/* VIDEO PREVIEW */

if(videoInput){
videoInput.onchange = () => {

const file = videoInput.files[0];
if(!file) return;

videoPreview.innerHTML =
`🎥 ${file.name}`;

videoPreview.classList.add("ready");

};
}

  /* AUTH */

  onAuthStateChanged(auth, user => {

    if (!user) {

      window.location = "login.html";
      return;

    }
    (async () => {

await loadAssignedSubjects();

loadMyCourses();
loadMyQuizzes();
loadEnrollmentStats();
loadCourseDropdown();

initAIQuizGenerator();

})();
  });
  
async function loadAssignedSubjects() {

  const teacherEmail =
    auth.currentUser.email.toLowerCase();

  const subjectSelect =
    document.getElementById("subjectSelect");

  subjectSelect.innerHTML =
    '<option value="">Select Subject</option>';

  const snap = await getDocs(
    query(
      collection(db, "subjects"),
      where("teacherEmail", "==", teacherEmail)
    )
  );

  snap.forEach(docSnap => {

    const subject = docSnap.data();
    assignedSubjects.push(
  subject.subjectName.trim().toLowerCase()
);

    const option =
      document.createElement("option");

    option.value = docSnap.id;

    option.textContent =
      `Semester ${subject.semester} - ${subject.subjectName}`;

    option.dataset.subject =
      subject.subjectName;
option.dataset.courseId =
  subject.subjectName.trim();
    
console.log(
  "Subject:",
  subject.subjectName,
  "CourseId:",
  option.dataset.courseId
);

    option.dataset.department =
      subject.department;

    option.dataset.semester =
      subject.semester;

    subjectSelect.appendChild(option);

    const aiSelect =
  document.getElementById(
    "aiSubjectSelect"
  );

if(aiSelect){

  const aiOption =
    document.createElement("option");

aiOption.value =
  option.dataset.courseId;

  aiOption.textContent =
    option.textContent;

  aiOption.dataset.subject =
    option.dataset.subject;

  aiOption.dataset.courseId =
    option.dataset.courseId;

  aiOption.dataset.department =
    option.dataset.department;

  aiOption.dataset.semester =
    option.dataset.semester;

  aiSelect.appendChild(aiOption);

}

  });

}
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

        showMessage("Open a course discussion first.");
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
      const selected =
  document.getElementById("subjectSelect")
  .selectedOptions[0];

if(!selected.value){

  showMessage("Select a subject");

  btn.classList.remove("loading");
  btn.disabled = false;

  return;
}

formData.append(
  "department",
  selected.dataset.department
);

formData.append(
  "semester",
  selected.dataset.semester
);

formData.append(
  "course",
  selected.dataset.subject
);

const token =
  await auth.currentUser.getIdToken();

const res = await fetch("/upload", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`
  },
  body: formData
});
if (!res.ok) {

  const errorText =
    await res.text();

  console.error(
    "UPLOAD ERROR:",
    errorText
  );

  showMessage(errorText);

  return;
}

const data = await res.json();

/* ===== READ TAGS ===== */

const tagsInput = uploadForm.tags.value || "";

const tags = tagsInput
  .split(",")
  .map(tag => tag.trim().toLowerCase())
  .filter(tag => tag.length > 0);

/* ===== SAVE COURSE ===== */

const courseId = data.course.trim();

const courseRef = doc(db, "courses", courseId);

/* ===== CREATE COURSE (ONLY ONCE) ===== */
await setDoc(courseRef, {
  department: data.department,
  semester: data.semester,
  course: data.course,
  tags: tags,
  coverURL: data.coverURL,
  uploadedBy: auth.currentUser.uid,
  createdAt: new Date()
}, { merge: true });

/* ===== ADD UNIT ===== */
await addDoc(
  collection(
    db,
    "courses",
    courseId,
    "units"
  ),
  {
    title: data.unitTitle || "Unit",
    pdfURL: data.pdfURL,
    videoURL: data.videoURL,
    uploadedBy: auth.currentUser.uid,
    courseId: courseId,
    createdAt: new Date()
  }
);

      btn.classList.remove("loading");
      btn.disabled = false;

      showMessage("Lecture uploaded successfully");
      dropdown.classList.add("hidden");

      uploadForm.reset();

    });

  }

  /* MY COURSES */
/* MY COURSES */
function loadMyCourses() {

onSnapshot(
  collection(db, "courses"),
  async (snapshot) => {

      courseContainer.innerHTML = "";

      const grouped = {};

      snapshot.forEach(docSnap => {

        const course = docSnap.data();

        const courseName =
  (course.course || "")
  .trim()
  .toLowerCase();

const teacherOwnsCourse =
  assignedSubjects.includes(courseName);

if (!teacherOwnsCourse) {
  return;
}

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

        const header = document.createElement("div");
        header.className = "dept-title";
        header.innerHTML = `<span class="material-symbols-outlined">
          newsstand
        </span> ${dept}`;

        const content = document.createElement("div");
        content.className = "dept-courses hidden";

        /* toggle folder */

        header.onclick = () => {
          content.classList.toggle("hidden");
        };

        section.appendChild(header);
        section.appendChild(content);

        courseContainer.appendChild(section);

        const grid = content;

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

            if (!(await confirmDelete("Delete this course?"))) return;

            await deleteDoc(doc(db, "courses", courseId));

          };

          grid.appendChild(div);

        });

      }

    });

  }

  /* ENROLLMENT STATS */

  async function loadEnrollmentStats() {

    const container = document.getElementById("enrollmentStats");

const courseSnap = await getDocs(
  collection(db, "courses")
);

    container.innerHTML = "";

    for (const c of courseSnap.docs) {

      const courseName =
  (c.data().course || "")
  .trim()
  .toLowerCase();

const teacherOwnsCourse =
  assignedSubjects.includes(courseName);

if (!teacherOwnsCourse) {
  continue;
}

      const enrollSnap = await getDocs(

        query(collection(db, "enrollments"),
          where("courseId", "==", c.id))

      );

      const div = document.createElement("div");

      div.className = "enrollment-card";

   div.className = "enrollment-card clickable";

div.innerHTML = `
<div>
  <div class="enrollment-course">${c.data().course}</div>
  <div class="enrollment-label">Students Enrolled</div>
</div>

<div class="enrollment-count">${enrollSnap.size}</div>
`;

div.onclick = () => {
  window.location = `courseStudents.html?courseId=${c.id}`;
};

      container.appendChild(div);

    }

  }

  /* COURSE DROPDOWN */

function loadCourseDropdown() {

  const select =
    document.getElementById("courseSelect");

  select.innerHTML =
    "<option value=''>Select Course</option>";

  assignedSubjects.forEach(subject => {

    const opt =
      document.createElement("option");

    opt.value = subject;
    opt.textContent = subject;

    select.appendChild(opt);

  });

  select.onchange = e => {
    loadStudentPerformance(
      e.target.value
    );
  };

}

  /* ================= STUDENT PERFORMANCE ================= */

  async function loadStudentPerformance(courseId) {

    const container = document.getElementById("performanceList");
    const resultsSnap = await getDocs(collection(db, "course_quiz_results"));

    container.innerHTML = "";

    const studentScores = {};
    const studentNames = {};

    for (const docSnap of resultsSnap.docs) {

      const data = docSnap.data();

      if (!data.quizId) continue;

      const quizSnap = await getDoc(doc(db, "quizzes", data.quizId));
      if (!quizSnap.exists()) continue;

      const quiz = quizSnap.data();

      if (quiz.courseId !== courseId) continue;

      let studentName = "Student";

      if (data.userId) {

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

      }

      if (!studentScores[data.userId]) {
        studentScores[data.userId] = [];
        studentNames[data.userId] = studentName;
      }

      studentScores[data.userId].push(data.score);

    }

    const names = [];
    const scores = [];
    const userIds = [];

    for (const uid in studentScores) {

      const arr = studentScores[uid];
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;

      names.push(studentNames[uid]);
      scores.push(Math.round(avg));
      userIds.push(uid);

      const div = document.createElement("div");

      div.innerHTML = `
<strong>${studentNames[uid]}</strong>
<p>${Math.round(avg)}%</p>
`;

      container.appendChild(div);

    }

    renderLollipopChart(names, scores);

    /* ===== Find Top & Lowest ===== */

    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    const topIndex = scores.indexOf(maxScore);
    const lowIndex = scores.indexOf(minScore);

    showMentorshipInsights(
      names[topIndex],
      userIds[topIndex],
      maxScore,
      names[lowIndex],
      userIds[lowIndex],
      minScore,
      courseId
    );

  }

  /* ================= LOLLIPOP CHART ================= */

  function renderLollipopChart(names, scores) {

    const ctx = document.getElementById("performanceChart");

    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(ctx, {

      type: "bar",

      data: {
        labels: names,
        datasets: [

          {
            type: "line",
            data: scores,
            borderColor: "#4f46e5",
            borderWidth: 2,
            pointRadius: 7,
            pointBackgroundColor: "#4f46e5",
            fill: false
          },

          {
            type: "bar",
            data: scores,
            backgroundColor: "#e0e7ff",
            borderWidth: 0
          }

        ]
      },

      options: {

        responsive: true,

        plugins: {
          legend: { display: false }
        },

        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: "Performance %"
            }
          }
        }

      }

    });

  }

  /* ================= MENTORSHIP PANEL ================= */

  function showMentorshipInsights(topName, topId, topScore, lowName, lowId, lowScore, courseId) {

    let box = document.getElementById("mentorshipBox");

    if (!box) {

      box = document.createElement("div");
      box.id = "mentorshipBox";
      box.className = "mentorship-box";

      document.getElementById("performanceChart").before(box);

    }

    box.innerHTML = `

<div class="mentor-item top">
🏆 Top Performer:
<span class="student-link" data-id="${topId}" data-course="${courseId}">
${topName} (${topScore}%)
</span>
</div>

<div class="mentor-item low">
⚠ Needs Mentorship:
<span class="student-link" data-id="${lowId}" data-course="${courseId}">
${lowName} (${lowScore}%)
</span>
</div>

`;

    document.querySelectorAll(".student-link").forEach(el => {

      el.onclick = () => {

        const studentId = el.dataset.id;
        const courseId = el.dataset.course;

        loadStudentWeeklyChart(studentId, courseId);

      };

    });

  }

  /* ================= WEEKLY PERFORMANCE ================= */

  async function loadStudentWeeklyChart(studentId, courseId) {

    const resultsSnap = await getDocs(collection(db, "course_quiz_results"));

    const weeklyScores = {};

    for (const docSnap of resultsSnap.docs) {

      const data = docSnap.data();

      if (!data.quizId) continue;
      if (data.userId !== studentId) continue;

      const quizSnap = await getDoc(doc(db, "quizzes", data.quizId));
      if (!quizSnap.exists()) continue;

      const quiz = quizSnap.data();

      if (quiz.courseId !== courseId) continue;

      const date = data.submittedAt.toDate();

      const week = `${date.getFullYear()}-${date.getMonth() + 1}-W${Math.ceil(date.getDate() / 7)}`;

      if (!weeklyScores[week]) weeklyScores[week] = [];

      weeklyScores[week].push(data.score);

    }

    const weeks = Object.keys(weeklyScores);

    const scores = weeks.map(w => {

      const arr = weeklyScores[w];

      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    });

    renderWeeklyChart(weeks, scores);

  }

  /* ================= WEEKLY BAR CHART ================= */

  function renderWeeklyChart(weeks, scores) {

    const ctx = document.getElementById("performanceChart");

    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(ctx, {

      type: "bar",

      data: {
        labels: weeks,
        datasets: [{
          label: "Weekly Performance %",
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
    container.innerHTML = "";

    const snap = await getDocs(collection(db, "course_quiz_results"));

    if (snap.empty) {
      container.innerHTML = "<p>No results yet.</p>";
      return;
    }

    const departmentMap = {};

    for (const resultDoc of snap.docs) {

      const data = resultDoc.data();

      let studentName = "Unknown Student";
      let courseName = "Unknown Course";
      let department = "Others";
      let submitTime = "Unknown time";

      /* FETCH USER */

      if (data.userId) {
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
      }

      /* FETCH QUIZ → COURSE */

    let quizTitle = "Untitled Quiz";  // ✅ declare OUTSIDE

if (data.quizId) {

  const quizSnap = await getDoc(doc(db, "quizzes", data.quizId));

  if (quizSnap.exists()) {

    const quiz = quizSnap.data();

    quizTitle = quiz.title || "Untitled Quiz";  // ✅ assign here

    const courseSnap = await getDoc(doc(db, "courses", quiz.courseId));

    if (courseSnap.exists()) {

      const course = courseSnap.data();

      courseName = course.course;
      department = course.department || "Others";

    }

  }

}

      /* FORMAT TIME */

if (data.submittedAt && data.submittedAt.toDate) {
  submitTime = data.submittedAt.toDate().toLocaleString();
}

 if (!departmentMap[department]) {
  departmentMap[department] = {};
}

if (!departmentMap[department][courseName]) {
  departmentMap[department][courseName] = {};
}

if (!departmentMap[department][courseName][quizTitle]) {
  departmentMap[department][courseName][quizTitle] = [];
}

departmentMap[department][courseName][quizTitle].push({
  studentName,
  score: data.score,
  submitTime
});

    }

    /* RENDER FOLDER STRUCTURE */

    for (const dept in departmentMap) {

      const deptDiv = document.createElement("div");
      deptDiv.className = "dept-folder";

      const deptHeader = document.createElement("div");
      deptHeader.className = "dept-title";
      deptHeader.innerHTML = `<span class="material-symbols-outlined">
newsstand
</span> ${dept}`;

      const deptContent = document.createElement("div");
      deptContent.className = "dept-content hidden";

      deptHeader.onclick = () => {
        deptContent.classList.toggle("hidden");
      };

      const courses = departmentMap[dept];

      for (const course in courses) {

        const courseDiv = document.createElement("div");

        const courseHeader = document.createElement("div");
        courseHeader.className = "course-title";
        courseHeader.innerHTML = `<span class="material-symbols-outlined">
newsstand
</span> ${course}`;

        const courseContent = document.createElement("div");
        courseContent.className = "course-content hidden";

        courseHeader.onclick = () => {
          courseContent.classList.toggle("hidden");
        };

       const quizzes = courses[course];

for (const quizTitle in quizzes) {

  const quizDiv = document.createElement("div");

  /* QUIZ TITLE */
  const quizHeader = document.createElement("div");
  quizHeader.className = "quiz-title";
  quizHeader.innerHTML = `${quizTitle}`;

  const quizContent = document.createElement("div");
  quizContent.className = "quiz-content";

  /* HEADER */
  const header = document.createElement("div");
  header.className = "results-header";

  header.innerHTML = `
<span>Name</span>
<span>Marks</span>
<span>Date Submitted</span>
`;

  quizContent.appendChild(header);

  quizzes[quizTitle].forEach(r => {

    const div = document.createElement("div");
    div.className = "result-item";

    div.innerHTML = `
<span>${r.studentName}</span>
<span class="result-score">${r.score}%</span>
<span>${r.submitTime}</span>
`;

    quizContent.appendChild(div);

  });

  quizDiv.appendChild(quizHeader);
  quizDiv.appendChild(quizContent);

  courseContent.appendChild(quizDiv);
}

        courseDiv.appendChild(courseHeader);
        courseDiv.appendChild(courseContent);
        deptContent.appendChild(courseDiv);

      }

      deptDiv.appendChild(deptHeader);
      deptDiv.appendChild(deptContent);

      container.appendChild(deptDiv);

    }

  }

  /* QUIZZES */
async function loadMyQuizzes() {

  quizContainer.innerHTML = "";

  const [manualSnap, aiSnap] = await Promise.all([
    getDocs(collection(db, "quizzes")),
    getDocs(collection(db, "course_quiz"))
  ]);

  const allQuizzes = [
    ...manualSnap.docs.map(d => ({
      id: d.id,
      source: "quizzes",
      ...d.data()
    })),
    ...aiSnap.docs.map(d => ({
      id: d.id,
      source: "course_quiz",
      ...d.data()
    }))
  ];

  if (!allQuizzes.length) {
    quizContainer.innerHTML =
      "<p>No quizzes available.</p>";
    return;
  }

  allQuizzes.forEach(quiz => {

    const div = document.createElement("div");

    div.innerHTML = `
      <p>
📝 <strong>${quiz.title}</strong><br>

Course:
${quiz.courseName || ""}

<br>

Unit:
${quiz.unitTitle || "Unknown Unit"}

<br>

<small>
${quiz.department || ""}
${quiz.semester
 ? ` | Semester ${quiz.semester}`
 : ""}
</small>
</p>

      <button class="editQuiz">
        Edit
      </button>

      <button class="deleteQuiz">
        Delete
      </button>

      <hr>
    `;

    div.querySelector(".editQuiz").onclick =
      () => {

        if (quiz.source === "quizzes") {
          window.location =
            "createQuiz.html?quiz=" + quiz.id;
        } else {
          window.location =
            "createQuiz.html?aiQuiz=" + quiz.id;
        }

      };

    div.querySelector(".deleteQuiz").onclick =
      async () => {

        const collectionName =
          quiz.source;

        await deleteDoc(
          doc(
            db,
            collectionName,
            quiz.id
          )
        );

        showMessage("Quiz deleted");
      };

    quizContainer.appendChild(div);

  });

}

});
async function initAIQuizGenerator() {

  document
  .getElementById(
    "saveAIQuizBtn"
  )
  .addEventListener(
    "click",
    saveAIQuiz
  );

  document
  .getElementById("regenerateAIQuizBtn")
  .addEventListener(
    "click",
    generateAIQuiz
  );

  const subjectSelect =
    document.getElementById(
      "aiSubjectSelect"
    );

  const unitSelect =
    document.getElementById(
      "aiUnitSelect"
    );

  subjectSelect.addEventListener(
    "change",
    async () => {

      unitSelect.innerHTML =
        "<option>Select Unit</option>";

const courseId =
  subjectSelect.selectedOptions[0]
  .dataset.courseId;

console.log(
  "Selected Course:",
  courseId
);

const units =
  await getDocs(
    collection(
      db,
      "courses",
      courseId,
      "units"
    )
  );

console.log(
  "Units Found:",
  units.size
);

const unitsSnap = await getDocs(
  collection(
    db,
    "courses",
    courseId,
    "units"
  )
);

unitSelect.innerHTML =
  "<option>Select Unit</option>";

unitsSnap.forEach(doc => {

  const unit = doc.data();

  const opt =
    document.createElement("option");

  opt.value = unit.pdfURL;
  opt.textContent = unit.title;

  unitSelect.appendChild(opt);

});

    }
  );

  document
    .getElementById(
      "generateAIQuizBtn"
    )
    .addEventListener(
      "click",
      generateAIQuiz
    );

}
async function generateAIQuiz() {

  const pdfURL =
    document.getElementById(
      "aiUnitSelect"
    ).value;

  if(!pdfURL){
    showMessage(
      "Select a unit"
    );
    return;
  }

  const res =
    await fetch(
      "/generate-test",
      {
        method:"POST",
        headers:{
          "Content-Type":
            "application/json"
        },
        body:JSON.stringify({
          pdfURL
        })
      }
    );

const data = await res.json();

console.log("AI RESPONSE:", data);

if (!res.ok) {

  showMessage(
    data.error || "Quiz generation failed"
  );

  return;
}

if (
  !data.questions ||
  !Array.isArray(data.questions)
) {

  showMessage(
    "No questions generated"
  );

  console.error(data);

  return;
}

const preview =
  document.getElementById(
    "generatedQuizPreview"
  );

preview.innerHTML = "";

generatedQuestions = data.questions;
data.questions.forEach(
    (q,index)=>{

preview.innerHTML += `
<div class="quiz-card">

<h4>Q${index+1}</h4>

<textarea
class="aiQuestion"
data-index="${index}"
>${q.question}</textarea>

<div class="quiz-options">

${q.options.map(opt => `
<div class="quiz-option">
${opt}
</div>
`).join("")}

</div>

<div class="quiz-answer">
Answer: ${q.answer}
</div>

</div>
`;

    }
  );

}
async function saveAIQuiz() {

  if (!generatedQuestions.length) {

    showMessage(
      "Generate a quiz first"
    );

    return;
  }

  const selected =
    document.getElementById(
      "aiSubjectSelect"
    ).selectedOptions[0];

  const department =
    selected.dataset.department;

  const semester =
    selected.dataset.semester;

  const courseId =
    selected.dataset.courseId;
    const courseName =
  selected.dataset.subject;

  const unitSelect =
  document.getElementById(
    "aiUnitSelect"
  );

const unitTitle =
  unitSelect.selectedOptions[0]
  ?.textContent || "";

const pdfURL =
  unitSelect.value;

const quizRef = await addDoc(
 collection(db,"course_quiz"),
{
   title: `${courseName} - ${unitTitle}`,

   courseId,
   courseName,

   unitTitle,
   pdfURL,

   department,
   semester,

   createdBy: auth.currentUser.uid,
   createdAt: new Date()
}
);

  for (
    let i = 0;
    i < generatedQuestions.length;
    i++
  ) {

    const q =
      generatedQuestions[i];

    const editedQuestion =
      document.querySelectorAll(
        ".aiQuestion"
      )[i].value;

    await addDoc(
collection(
  db,
  "course_quiz_questions"
),
      {
        quizId:
          quizRef.id,

        courseId,

        question:
          editedQuestion,

        options:
          q.options,

        answer:
          q.answer,

        explanation:
          q.explanation || ""
      }
    );

  }

  showMessage(
    "Quiz Saved"
  );

}