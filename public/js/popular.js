import { db, auth } from "./firebase.js";

import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
/* ================= PAGE TITLE ================= */

const deptTitle = document.getElementById("deptTitle");

if(deptTitle){
  deptTitle.textContent = "Popular Books";
}

/* ================= MESSAGE ================= */

let messageTimer;

function showMessage(text){

  const msg = document.getElementById("systemMessage");
  if(!msg) return;

  msg.innerText = text;
  msg.style.display = "block";

  clearTimeout(messageTimer);

  messageTimer = setTimeout(()=>{
    msg.style.display="none";
  },3000);

}

/* ================= ELEMENTS ================= */

const container = document.getElementById("popularSections");
const template = document.getElementById("courseCardTemplate");

const modal = document.getElementById("joinModal");
const confirmBtn = document.getElementById("confirmJoin");
const cancelBtn = document.getElementById("cancelJoin");
const courseText = document.getElementById("joinCourseName");

/* ================= DATA ================= */

let allCourses = [];
let joinedCourses = new Set();
let currentUser = null;
let selectedCourse = null;

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user)=>{

  currentUser = user;

  await loadEnrollments();

  renderPopular();

});

/* ================= LOAD ENROLLMENTS ================= */

async function loadEnrollments(){

  joinedCourses.clear();

  if(!currentUser) return;

  const enrollSnap = await getDocs(
    query(collection(db,"enrollments"),where("userId","==",currentUser.uid))
  );

  enrollSnap.forEach(doc=>{
    joinedCourses.add(doc.data().courseId);
  });

}

/* ================= LOAD COURSES ================= */

const coursesRef = collection(db,"courses");

onSnapshot(coursesRef,(snapshot)=>{

  allCourses = snapshot.docs.map(doc=>({
    id:doc.id,
    ...doc.data()
  }));

  renderPopular();

});

/* ================= RENDER POPULAR ================= */

async function renderPopular(){

  if(!container) return;

  /* ===== GET ENROLLMENT COUNTS ===== */

  const enrollSnap = await getDocs(collection(db,"enrollments"));

  const counts = {};

  enrollSnap.forEach(doc=>{
    const courseId = doc.data().courseId;

    if(!counts[courseId]) counts[courseId] = 0;

    counts[courseId]++;
  });

  /* ===== SORT BY POPULARITY ===== */

  const popularCourses = allCourses
    .filter(course => counts[course.id] > 0)
    .sort((a,b)=>counts[b.id] - counts[a.id]);

  container.innerHTML = "";

  if(!popularCourses.length){
    container.innerHTML = "<p>No popular books yet.</p>";
    return;
  }

  /* ===== RENDER BOOK CARDS ===== */

  popularCourses.forEach(course=>{

    const isJoined = joinedCourses.has(course.id);

    const card = template.content.cloneNode(true);

    const cover = card.querySelector(".book-cover");
    const title = card.querySelector(".course-title");
    const semester = card.querySelector(".course-semester");
    const pdfBtn = card.querySelector(".pdf-btn");
    const joinBtn = card.querySelector(".join-btn");
    const locked = card.querySelector(".locked");

    /* ===== DATA ===== */

    title.textContent = course.course;
    semester.textContent = "Semester " + course.semester;

    if(course.coverURL){
      cover.src = course.coverURL;
    } else{
      cover.style.display="none";
    }

    /* ===== JOIN STATE ===== */

    if(isJoined){

      joinBtn.textContent="Joined";
      joinBtn.disabled=true;

      locked.style.display="none";

      pdfBtn.href = course.pdfURL;

    }
    else{

      pdfBtn.style.display="none";

      joinBtn.textContent="Join Course";

      joinBtn.onclick = ()=>{

        if(!currentUser){
          alert("Login first.");
          return;
        }

        selectedCourse = course;

        courseText.textContent = `Join ${course.course}?`;

        modal.classList.add("show");

      };

    }

    container.appendChild(card);

  });

}

/* ================= MODAL ================= */

cancelBtn.onclick = ()=>{
  modal.classList.remove("show");
};

confirmBtn.onclick = async ()=>{

  if(!selectedCourse || !currentUser) return;

  modal.classList.remove("show");

  await addDoc(collection(db,"enrollments"),{
    userId:currentUser.uid,
    courseId:selectedCourse.id,
    courseName:selectedCourse.course,
    department:selectedCourse.department,
    joinedAt:new Date()
  });

  joinedCourses.add(selectedCourse.id);

  showMessage("Successfully joined the course");

  renderPopular();

};