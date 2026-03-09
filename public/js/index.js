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


let messageTimer;

/* ================= MESSAGE SYSTEM ================= */

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


document.addEventListener("DOMContentLoaded", () => {

  const container = document.getElementById("departmentSections");
  const searchInput = document.getElementById("courseSearch");
  const template = document.getElementById("courseCardTemplate");

  if (!container) return;

  let currentUser = null;
  let allCourses = [];
  let joinedCourses = new Set();
  let searchTerm = "";



/* ================= JOIN MODAL ================= */

const modal = document.getElementById("joinModal");
const courseText = document.getElementById("joinCourseName");
const confirmBtn = document.getElementById("confirmJoin");
const cancelBtn = document.getElementById("cancelJoin");

let pendingJoin = null;


cancelBtn.onclick = ()=>{
  modal.classList.remove("show");
  pendingJoin = null;
};


confirmBtn.onclick = async ()=>{

  if(!pendingJoin) return;

  const {user, course, dept, joinBtn} = pendingJoin;

  modal.classList.remove("show");

  joinBtn.disabled = true;
  joinBtn.textContent = "Joining...";

  await addDoc(collection(db,"enrollments"),{
    userId:user.uid,
    courseId:course.id,
    courseName:course.course,
    department:dept,
    joinedAt:new Date()
  });

  joinedCourses.add(course.id);

  showMessage("Successfully joined the course");

  renderCourses();

  pendingJoin = null;

};



/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  currentUser = user;

  if (user) {

    const enrollQuery = query(
      collection(db,"enrollments"),
      where("userId","==",user.uid)
    );

    const enrollSnap = await getDocs(enrollQuery);

    joinedCourses.clear();

    enrollSnap.forEach(doc=>{
      joinedCourses.add(doc.data().courseId);
    });

  }

  renderCourses();

});


/* ================= SEARCH ================= */

if (searchInput) {

  searchInput.addEventListener("input", (e) => {

    searchTerm = e.target.value.toLowerCase();
    renderCourses();

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

function renderCourses(){

  container.innerHTML="";

  if(!allCourses.length){
    container.innerHTML="<p>No courses uploaded yet.</p>";
    return;
  }

  const grouped = {};

  for(const course of allCourses){

    if(searchTerm && !course.course.toLowerCase().includes(searchTerm)){
      continue;
    }

    const dept = (course.department || "Others").trim().toUpperCase();

    if(!grouped[dept]) grouped[dept]=[];

    grouped[dept].push(course);

  }



  for(const dept of Object.keys(grouped)){

    const section=document.createElement("div");
    section.className="dept-section";

    section.innerHTML=`
      <div class="dept-header">

        <h3 class="dept-title">${dept}</h3>

        <a class="show-more" href="department.html?dept=${encodeURIComponent(dept)}">
          Show More
        </a>

      </div>

      <div class="dept-slider"></div>
    `;

    container.appendChild(section);

    const slider=section.querySelector(".dept-slider");



    for(const course of grouped[dept]){

      const isJoined = joinedCourses.has(course.id);

      const card = template.content.cloneNode(true);

      const cover = card.querySelector(".book-cover");
      const title = card.querySelector(".course-title");
      const semester = card.querySelector(".course-semester");
      const pdfBtn = card.querySelector(".pdf-btn");
      const joinBtn = card.querySelector(".join-btn");
      const locked = card.querySelector(".locked");

      title.textContent = course.course;
      semester.textContent = "Semester " + course.semester;



      /* ================= COVER ================= */

      if(course.coverURL){
        cover.src = course.coverURL;
      }else{
        cover.style.display = "none";
      }



      /* ================= JOIN STATE ================= */

      if(isJoined){

        joinBtn.textContent = "Joined";
        joinBtn.disabled = true;

        locked.style.display = "none";

        pdfBtn.href = course.pdfURL;

      }

      else{

        pdfBtn.style.display = "none";

        joinBtn.textContent = "Join Course";

        joinBtn.onclick = ()=>{

          const user = auth.currentUser;

          if(!user){
            showMessage("Login first.");
            return;
          }

          courseText.textContent = `Join ${course.course}?`;

          pendingJoin = {
            user,
            course,
            dept,
            joinBtn
          };

          modal.classList.add("show");

        };

      }



      slider.appendChild(card);

    }

  }

  observeSections();

}



/* ================= SCROLL REVEAL ================= */

function observeSections(){

  const sections=document.querySelectorAll(".dept-section");

  const observer=new IntersectionObserver(entries=>{

    entries.forEach(entry=>{

      if(entry.isIntersecting){

        entry.target.style.opacity=1;
        entry.target.style.transform="translateY(0)";

      }

    });

  },{threshold:0.2});

  sections.forEach(section=>observer.observe(section));

}


});
const slides = document.querySelectorAll(".hero-slide");
let index = 0;

setInterval(()=>{

slides[index].classList.remove("active");

index++;

if(index >= slides.length){
index = 0;
}

slides[index].classList.add("active");

},7000);