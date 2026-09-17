import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let messageTimer;

function showMessage(text){

  const msg = document.getElementById("systemMessage");
  if(!msg) return;

  msg.innerText = text;
  msg.style.display = "block";

  clearTimeout(messageTimer);

  messageTimer = setTimeout(()=>{
    msg.style.display = "none";
  },3000);

}
/* ================= GET DEPARTMENT ================= */

const params = new URLSearchParams(window.location.search);
const department = decodeURIComponent(params.get("dept") || "").trim();
const deptTitle = document.getElementById("deptTitle");

if(deptTitle){
  deptTitle.textContent = department ;
}
/* ================= ELEMENTS ================= */

const container = document.getElementById("departmentSections");
const searchInput = document.getElementById("courseSearch");
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

onAuthStateChanged(auth, async (user) => {

  currentUser = user;

  await loadEnrollments();

  renderCourses();

});

/* ================= LOAD ENROLLMENTS ================= */

async function loadEnrollments(){

  joinedCourses.clear();

  if(!currentUser) return;

  const enrollSnap = await getDocs(
    query(collection(db,"enrollments"), where("userId","==",currentUser.uid))
  );

  enrollSnap.forEach(doc=>{
    joinedCourses.add(doc.data().courseId);
  });

}

/* ================= FIRESTORE COURSES ================= */

const coursesRef = collection(db,"courses");

onSnapshot(coursesRef,(snapshot)=>{

  allCourses = snapshot.docs.map(doc => ({
    id:doc.id,
    ...doc.data()
  }));

  renderCourses();

});

/* ================= RENDER COURSES ================= */

function renderCourses(filter=""){

  container.innerHTML="";

  const filtered = allCourses.filter(course => {

    const deptMatch =
      (course.department || "").toLowerCase().trim() ===
      department.toLowerCase().trim();

    const nameMatch =
      (course.course || "").toLowerCase().includes(filter);

    return deptMatch && nameMatch;

  });

  if(!filtered.length){
    container.innerHTML="<p>No courses found.</p>";
    return;
  }

  filtered.forEach(course => {

    const isJoined = joinedCourses.has(course.id);

    const card = template.content.cloneNode(true);

    const cover = card.querySelector(".book-cover");
    const title = card.querySelector(".course-title");
    const semester = card.querySelector(".course-semester");
    const pdfBtn = card.querySelector(".pdf-btn");
    const joinBtn = card.querySelector(".join-btn");
    const locked = card.querySelector(".locked");

    /* ===== COURSE DATA ===== */

    title.textContent = course.course;
    semester.textContent = "Semester " + course.semester;

    /* ===== COVER ===== */

    if(course.coverURL){
      cover.src = course.coverURL;
    } else {
      cover.style.display = "none";
    }

    /* ===== JOIN STATE ===== */

    if(isJoined){

      joinBtn.textContent = "Joined";
      joinBtn.disabled = true;

      locked.style.display = "none";

      pdfBtn.href = course.pdfURL;

    }
    else{

      pdfBtn.style.display = "none";

      joinBtn.textContent = "Join Course";

      joinBtn.onclick = () => {

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
    department:department,
    joinedAt:new Date()
  });

  joinedCourses.add(selectedCourse.id);

  showMessage("Successfully joined the course");

  renderCourses();

};

/* ================= SEARCH ================= */

if(searchInput){

  searchInput.addEventListener("input",(e)=>{

    const term = e.target.value.toLowerCase();

    renderCourses(term);

  });

}