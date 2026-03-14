import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= SHOW MESSAGE ================= */

function showMessage(message, type = "info") {

  let box = document.getElementById("systemMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "systemMessage";
    document.body.appendChild(box);
  }

  box.className = "systemMessage " + type;
  box.innerText = message;
  box.style.display = "block";

  setTimeout(() => {
    box.style.display = "none";
  }, 3000);

}
let activeCourseId = null;
let quizTimer = null;
let aiQuizUsed = false;
let aiChartInstance = null;
let courseChartInstance = null;
/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadCourses(user.uid);
  loadLearningHistory(user.uid);
  loadStats(user.uid);
  loadCharts(user.uid);
  generateRecommendations(user.uid);

});
});


/* ================= LOAD COURSES ================= */
async function loadCourses(uid) {

  const enrollQuery = query(
    collection(db, "enrollments"),
    where("userId", "==", uid)
  );

  const enrolledDiv = document.getElementById("enrolledCourses");
  const courseSelect = document.getElementById("courseSelect");

  onSnapshot(enrollQuery, async (snapshot) => {

    enrolledDiv.innerHTML = "";
    courseSelect.innerHTML = "";

    document.getElementById("courseCount").innerText = snapshot.size;

    for (const enrollDoc of snapshot.docs) {

      const courseId = enrollDoc.data().courseId;

      const courseDoc = await getDoc(doc(db, "courses", courseId));
      if (!courseDoc.exists()) continue;

      const data = courseDoc.data();

      /* ===== dropdown select ===== */

      const option = document.createElement("option");
      option.value = courseId;
      option.textContent = data.course;
      courseSelect.appendChild(option);

      /* ===== check quiz ===== */

      const quizQuery = query(
        collection(db, "quizzes"),
        where("courseId", "==", courseId)
      );

      const quizSnap = await getDocs(quizQuery);

      let quizButton = "";
      if (!quizSnap.empty) {
        quizButton = `<button class="quizBtn">Take Quiz</button>`;
      }

      /* ===== course card ===== */

      const div = document.createElement("div");

      div.innerHTML = `
      <p>
      <strong>${data.course}</strong>
      (${data.department} - Sem ${data.semester})
      </p>

      ${data.pdfURL ? `<a class="pdfLink">📄 View PDF</a>` : ""}

      <br><br>

      ${data.videoURL ? `
      <video width="350" controls>
      <source src="${data.videoURL}">
      </video>` : ""}

      <br><br>

      <button class="discussionBtn">💬 Discussion</button>

      ${quizButton}

      <hr>
      `;

      /* ===== TRACK PDF OPEN ===== */

      const pdfLink = div.querySelector(".pdfLink");

      if (pdfLink) {

        pdfLink.href = data.pdfURL;
        pdfLink.target = "_blank";

        pdfLink.addEventListener("click", async () => {

          try {

            await addDoc(collection(db, "learning_activity"), {
              userId: auth.currentUser.uid,
              courseId: courseId,
              department: data.department,
              openedAt: new Date()
            });

          } catch (err) {

            console.error("Activity tracking failed:", err);

          }

        });

      }

      /* ===== discussion button ===== */

      const discussionBtn = div.querySelector(".discussionBtn");

      if (discussionBtn) {

        discussionBtn.onclick = () => {

          activeCourseId = courseId;

          loadComments(courseId);

          document
            .getElementById("chatBox")
            .classList.remove("hidden");

        };

      }

      /* ===== quiz button ===== */

      if (!quizSnap.empty) {

        const quizBtn = div.querySelector(".quizBtn");

        if (quizBtn) {

          quizBtn.onclick = () => {
            startTeacherQuiz(courseId);
          };

        }

      }

      enrolledDiv.appendChild(div);

    }

  });

}
async function generateRecommendations(uid){

  const container = document.getElementById("recommendedBooks");
  if(!container) return;

  /* ===== USER ACTIVITY ===== */

  const activitySnap = await getDocs(
    query(collection(db,"learning_activity"),
    where("userId","==",uid))
  );

  if(activitySnap.empty){
    container.innerHTML="No recommendations yet.";
    return;
  }

  const tagScore = {};
  const readCourses = new Set();

  /* ===== GET TAGS FROM READ BOOKS ===== */

  for(const activity of activitySnap.docs){

    const courseId = activity.data().courseId;
    readCourses.add(courseId);

    const courseDoc = await getDoc(doc(db,"courses",courseId));
    if(!courseDoc.exists()) continue;

    const tags = courseDoc.data().tags || [];

    tags.forEach(tag=>{
      const t = tag.toLowerCase();

      if(!tagScore[t]) tagScore[t]=0;
      tagScore[t]++;
    });

  }

  /* ===== LOAD ALL COURSES ===== */

  const courseSnap = await getDocs(collection(db,"courses"));

  const recommendations = [];

  courseSnap.forEach(docSnap=>{

    const data = docSnap.data();
    const courseId = docSnap.id;

    /* skip already read books */

    if(readCourses.has(courseId)) return;

    const tags = (data.tags || []).map(t=>t.toLowerCase());

    let score = 0;

    tags.forEach(tag=>{
      if(tagScore[tag]) score += tagScore[tag];
    });

    if(score > 0){

      recommendations.push({
        id:courseId,
        ...data,
        score
      });

    }

  });

  /* ===== SORT BY RELEVANCE ===== */

  recommendations.sort((a,b)=>b.score-a.score);

  const topBooks = recommendations.slice(0,6);

  container.innerHTML="";

const template = document.getElementById("courseCardTemplate");

topBooks.forEach(book=>{

const card = template.content.cloneNode(true);

const cover = card.querySelector(".book-cover");
const title = card.querySelector(".course-title");
const semester = card.querySelector(".course-semester");
const pdfBtn = card.querySelector(".pdf-btn");
const joinBtn = card.querySelector(".join-btn");
const locked = card.querySelector(".locked");

title.textContent = book.course;
semester.textContent = "Semester " + book.semester;

if(book.coverURL){
cover.src = book.coverURL;
}else{
cover.style.display = "none";
}

pdfBtn.href = book.pdfURL;

/* dashboard recommendations don't require join */
/* Hide all action elements for recommendation cards */

pdfBtn.style.display = "none";
joinBtn.style.display = "none";
locked.style.display = "none";
joinBtn.style.display = "none";
locked.style.display = "none";

container.appendChild(card);

});

}

/* ================= LEARNING HISTORY ================= */

async function loadLearningHistory(uid) {

  const historyDiv = document.getElementById("learningHistory");

  const enrollQuery = query(
    collection(db, "enrollments"),
    where("userId", "==", uid)
  );

  const snap = await getDocs(enrollQuery);

  historyDiv.innerHTML = "";

  for (const docSnap of snap.docs) {

    const courseId = docSnap.data().courseId;

    const courseDoc = await getDoc(doc(db, "courses", courseId));

    if (!courseDoc.exists()) continue;

    const data = courseDoc.data();

    const div = document.createElement("div");

    div.innerHTML = `

<strong>${data.course}</strong>

<p>Department: ${data.department}</p>

<p>Semester: ${data.semester}</p>

<hr>

`;

    historyDiv.appendChild(div);

  }

}


/* ================= STATS ================= */

async function loadStats(uid) {

  const aiQuery = query(
    collection(db, "ai_quiz_results"),
    where("userId", "==", uid)
  );

  const aiSnap = await getDocs(aiQuery);
  document.getElementById("aiQuizCount").innerText = aiSnap.size;

  const courseQuery = query(
    collection(db, "course_quiz_results"),
    where("userId", "==", uid)
  );

  const courseSnap = await getDocs(courseQuery);
  document.getElementById("courseQuizCount").innerText = courseSnap.size;

}


/* ================= CHARTS ================= */

async function loadCharts(uid) {

  const aiCanvas = document.getElementById("aiQuizChart");
  const courseCanvas = document.getElementById("courseQuizChart");

  /* ================= AI QUIZ CHART ================= */

  const aiQuery = query(
    collection(db, "ai_quiz_results"),
    where("userId", "==", uid)
  );

  const aiSnap = await getDocs(aiQuery);

  const aiLabels = [];
  const aiScores = [];

  aiSnap.forEach(doc => {
    const data = doc.data();

    aiLabels.push("AI Quiz " + (aiLabels.length + 1));
    aiScores.push(data.score);
  });

  if (aiCanvas) {

    if (aiChartInstance) aiChartInstance.destroy();

    aiChartInstance = new Chart(aiCanvas, {
      type: "bar",
      data: {
        labels: aiLabels,
        datasets: [{
          label: "AI Quiz Score",
          data: aiScores,
          backgroundColor: "#6366f1"
        }]
      }
    });

  }


  /* ================= COURSE QUIZ CHART ================= */

  const courseQuery = query(
    collection(db, "course_quiz_results"),
    where("userId", "==", uid)
  );

  const courseSnap = await getDocs(courseQuery);

  const courseLabels = [];
  const courseScores = [];

  courseSnap.forEach(doc => {
    const data = doc.data();

    courseLabels.push("Quiz " + (courseLabels.length + 1));
    courseScores.push(data.score);
  });

  if (courseCanvas) {

    if (courseChartInstance) courseChartInstance.destroy();

    courseChartInstance = new Chart(courseCanvas, {
      type: "bar",
      data: {
        labels: courseLabels,
        datasets: [{
          label: "Course Quiz Score",
          data: courseScores,
          backgroundColor: "#22c55e"
        }]
      }
    });

  }

}


/* ================= COURSE QUIZ ================= */

async function startTeacherQuiz(courseId) {

  const quizQuery = query(
    collection(db, "quizzes"),
    where("courseId", "==", courseId)
  );

  const quizSnap = await getDocs(quizQuery);

  if (quizSnap.empty) {
    showMessage("No quiz available");
    return;
  }

  const quizDoc = quizSnap.docs[0];
  const quizId = quizDoc.id;
  const quizData = quizDoc.data();

  /* prevent reattempt */

  const resultId = auth.currentUser.uid + "_" + quizId;
  const resultDoc = await getDoc(doc(db, "course_quiz_results", resultId));

  if (resultDoc.exists()) {
    showMessage("You already attempted this quiz");
    return;
  }

  const questionQuery = query(
    collection(db, "quiz_questions"),
    where("quizId", "==", quizId)
  );

  const questionSnap = await getDocs(questionQuery);

  const questions = questionSnap.docs.map(d => d.data());

  renderQuiz(questions, quizId, quizData);

}


/* ================= AI QUIZ ================= */

window.startTest = async function () {

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  const dashboard = document.querySelector(".dashboard");

  const loading = document.createElement("div");
  loading.className = "card";

  loading.innerHTML = `
<h3>Generating AI Quiz...</h3>
<div class="spinner"></div>
`;

  dashboard.prepend(loading);

  try {

    const courseSelect = document.getElementById("courseSelect");

    if (!courseSelect.value) {
      showMessage("Select a course first");
      loading.remove();
      return;
    }

    const courseId = courseSelect.value;

    const courseDoc = await getDoc(doc(db, "courses", courseId));
    const courseData = courseDoc.data();

    const res = await fetch("/generate-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfURL: courseData.pdfURL
      })
    });

    const data = await res.json();

    loading.remove();

    if (!data.questions || !Array.isArray(data.questions)) {
      showMessage("AI quiz generation failed");
      return;
    }

    /* create unique attempt id */
    const attemptId = auth.currentUser.uid + "_ai_" + Date.now();

    renderQuiz(data.questions, "aiQuiz", {
      title: "AI Quick Quiz",
      attemptId
    });

  }
  catch (err) {

    console.error(err);

    loading.remove();
    showMessage("Quiz generation failed");

  }

};

/* ================= RENDER QUIZ ================= */

function renderQuiz(questions, quizId, quizData) {

  const attemptId = quizData.attemptId || null;

  const dashboard = document.querySelector(".dashboard");

  const container = document.createElement("div");

  container.className = "card";

  container.innerHTML = `
<h3>${quizData.title}</h3>
${quizId !== "aiQuiz" && quizData.timeLimit ? `<div id="timer"></div>` : ""}
`;

  dashboard.prepend(container);

  if (quizId !== "aiQuiz" && quizData.timeLimit) {
    startTimer(quizData.timeLimit);
  }

  questions.forEach((q, i) => {

    const div = document.createElement("div");

    div.innerHTML = `<p><b>${i + 1}. ${q.question}</b></p>`;

    (q.options || []).forEach((opt, index) => {
      div.innerHTML += `
<label>
<input type="radio" name="q${i}" value="${index}">
${opt}
</label><br>
`;
    });

    div.innerHTML += `<div id="explain${i}" style="display:none;"></div>`;

    container.appendChild(div);

  });

/* ================= QUIZ BUTTON CONTAINER ================= */

const buttonBox = document.createElement("div");
buttonBox.className = "quiz-action-buttons";
  const submit = document.createElement("button");

  submit.className = "quiz-submit-btn";
submit.innerText = "Submit Quiz";

  submit.onclick = async () => {

    clearInterval(quizTimer);

    let score = 0;

    questions.forEach((q, i) => {

      const selected = document.querySelector(`input[name="q${i}"]:checked`);

      let correctIndex = -1;

      const letterMap = ["a", "b", "c", "d"];

      if (letterMap.includes(String(q.answer).toLowerCase().trim())) {
        correctIndex = letterMap.indexOf(String(q.answer).toLowerCase().trim());
      }
      else {
        correctIndex = q.options.findIndex(
          opt => opt.trim().toLowerCase() === String(q.answer).trim().toLowerCase()
        );
      }

      const options = document.querySelectorAll(`input[name="q${i}"]`);

options.forEach(opt => {

  const label = opt.parentElement;

  if(Number(opt.value) === correctIndex){
    label.style.background = "#dcfce7";   // green
    label.style.border = "2px solid #22c55e";
  }

  if(opt.checked && Number(opt.value) !== correctIndex){
    label.style.background = "#fee2e2";   // red
    label.style.border = "2px solid #ef4444";
  }

});

if(selected && Number(selected.value) === correctIndex){
score++;
}

      /* show explanation */
      if (quizId === "aiQuiz") {

        const explain = document.getElementById(`explain${i}`);

        explain.style.display = "block";

        explain.innerHTML = `
<p><b>Correct Answer:</b> ${q.answer}</p>
<p><b>Explanation:</b> ${q.explanation || "No explanation available."}</p>
`;

      }

    });

    const percent = (score / questions.length) * 100;

    if (quizId !== "aiQuiz") {

      const resultId = auth.currentUser.uid + "_" + quizId;

      await setDoc(doc(db, "course_quiz_results", resultId), {
        userId: auth.currentUser.uid,
        quizId,
        score: percent,
        submittedAt: new Date()
      });

      showMessage("Quiz submitted successfully.");

      container.remove();
      loadStats(auth.currentUser.uid);
      loadCharts(auth.currentUser.uid);

    } else {

      /* save AI quiz result */

      const resultId = attemptId;

      const resultDoc = await getDoc(doc(db, "ai_quiz_results", resultId));

      if (resultDoc.exists()) {
        showMessage("You already submitted this quiz.");
        return;
      }

      await setDoc(doc(db, "ai_quiz_results", resultId), {
        userId: auth.currentUser.uid,
        score: percent,
        submittedAt: new Date()
      });

      aiQuizUsed = true;

      showMessage("AI Quiz submitted! Score: " + percent + "%");
      loadStats(auth.currentUser.uid);
      loadCharts(auth.currentUser.uid);
    }

  };
  /* ================= REGENERATE BUTTON ================= */

  if (quizId === "aiQuiz") {

    const regen = document.createElement("button");
regen.className = "quiz-regenerate-btn";

    regen.innerText = "Regenerate Quiz";

    regen.style.marginLeft = "10px";

    regen.onclick = () => {

      container.remove();

      startTest(); // generate new AI quiz

    };

    buttonBox.appendChild(regen);

  }
  buttonBox.appendChild(submit);
  container.appendChild(buttonBox);

}


/* ================= TIMER ================= */

function startTimer(minutes) {

  let time = minutes * 60;

  const timer = document.getElementById("timer");

  quizTimer = setInterval(() => {

    time--;

    const m = Math.floor(time / 60);
    const s = time % 60;

    timer.innerText = `Time: ${m}:${s}`;

    if (time <= 0) {

      clearInterval(quizTimer);

      showMessage("Time up!");

    }

  }, 1000);

}


/* ================= DISCUSSION ================= */

async function loadComments(courseId) {

  const q = query(
    collection(db, "course_comments"),
    where("courseId", "==", courseId),
    orderBy("createdAt", "asc")
  );

  const list = document.querySelector(".commentList");

  onSnapshot(q, (snap) => {

    list.innerHTML = "";

    snap.forEach(docSnap => {

      const data = docSnap.data();

      const div = document.createElement("div");

      const role = data.userId === auth.currentUser.uid ? "teacher" : "student";

      div.className = "chatMsg " + role;

      div.innerHTML = `
<strong>${data.userName}</strong>
<p>${data.message}</p>
`;

      list.appendChild(div);

    });

    list.scrollTop = list.scrollHeight;

  });

}


/* ================= SEND COMMENT ================= */

document.querySelector(".sendComment").onclick = async () => {

  const input = document.querySelector(".commentInput");

  if (!input.value.trim()) return;

  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));

  const user = userDoc.data();

  await addDoc(collection(db, "course_comments"), {

    courseId: activeCourseId,
    userId: auth.currentUser.uid,
    userName: user.firstName || user.email,
    message: input.value,
    createdAt: new Date()

  });

  input.value = "";

};


/* ================= CHAT CLOSE ================= */

const chatBox = document.getElementById("chatBox");
const closeBtn = document.getElementById("chatClose");

if (chatBox && closeBtn) {

  closeBtn.onclick = () => {
    chatBox.classList.add("hidden");
  };

}