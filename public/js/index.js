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

/* ===== GET STARTED SCROLL ===== */

const startBtn = document.getElementById("getStartedBtn");

if(startBtn){

startBtn.addEventListener("click",(e)=>{

e.preventDefault();

document.getElementById("recentUploads").scrollIntoView({
behavior:"smooth"
});

});

}

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
  const searchDropdown = document.getElementById("searchDropdown");

  if (!container) return;

  let currentUser = null;
  let allCourses = [];
  let joinedCourses = new Set();
  let searchTerm = "";

  let userDepartment = "";
  let userSemester = "";


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

  if(user){

  const usersSnap = await getDocs(
    query(
      collection(db,"users"),
      where("email","==",user.email)
    )
  );

  if(!usersSnap.empty){

    const userData = usersSnap.docs[0].data();

    userDepartment =
      String(userData.department || "")
      .trim()
      .toUpperCase();

    userSemester =
      String(userData.semester || "")
      .trim();
  }

}

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


/* ================= SEARCH (UPDATED) ================= */

if(searchInput){

searchInput.addEventListener("input",(e)=>{

const term = e.target.value.toLowerCase().trim();

if(term === ""){
searchDropdown.style.display="none";
return;
}

const results = allCourses.filter(course => {

const nameMatch =
course.course?.toLowerCase().includes(term);

const tagMatch =
course.tags?.some(tag =>
tag.toLowerCase().includes(term)
);

return nameMatch || tagMatch;

}).slice(0,6);

renderSearchDropdown(results);

});

}


/* ================= SEARCH DROPDOWN ================= */

function renderSearchDropdown(results){

searchDropdown.innerHTML="";

if(results.length === 0){

searchDropdown.innerHTML="<div class='search-item'>No results found</div>";
searchDropdown.style.display="block";
return;

}

results.forEach(course=>{

const dept = (course.department || "Others").trim().toUpperCase();

const item=document.createElement("div");
item.className="search-item";

item.innerHTML=`
${course.coverURL ? `<img src="${course.coverURL}">` : ""}
<div>
<h4>${course.course}</h4>
<p>${dept} • Semester ${course.semester}</p>
</div>
`;

item.onclick=()=>{
window.location.href=
`department.html?dept=${encodeURIComponent(dept)}`;
};

searchDropdown.appendChild(item);

});

searchDropdown.style.display="block";

}


/* Hide dropdown when clicking outside */

document.addEventListener("click",(e)=>{

if(!e.target.closest(".search-box")){
searchDropdown.style.display="none";
}

});


/* ================= FIRESTORE COURSES ================= */

const coursesRef = collection(db,"courses");

onSnapshot(coursesRef,(snapshot)=>{

  allCourses = snapshot.docs.map(doc => ({
    id:doc.id,
    ...doc.data()
  }));

  renderCourses();
  loadPopularBooks();

});

async function loadPopularBooks(){

  const container = document.getElementById("popularBooks");
  if(!container) return;

  const enrollSnap = await getDocs(collection(db,"enrollments"));

  const counts = {};

  enrollSnap.forEach(doc=>{
    const courseId = doc.data().courseId;
    if(!counts[courseId]) counts[courseId] = 0;
    counts[courseId]++;
  });

const popularCourses = allCourses
  .filter(course =>

    counts[course.id] > 0 &&

    String(course.department || "")
      .trim()
      .toUpperCase() === userDepartment &&

    String(course.semester || "")
      .trim() === userSemester

  )
  .sort((a,b)=>counts[b.id] - counts[a.id])
  .slice(0,10);

  container.innerHTML = "";

  if(popularCourses.length === 0){
    container.innerHTML = "<p>No popular books yet.</p>";
    return;
  }

  for(const course of popularCourses){

    const card = template.content.cloneNode(true);

    const cover = card.querySelector(".book-cover");
    const title = card.querySelector(".course-title");
    const semester = card.querySelector(".course-semester");
    const pdfBtn = card.querySelector(".pdf-btn");
    const joinBtn = card.querySelector(".join-btn");
    const locked = card.querySelector(".locked");

    title.textContent = course.course;
    semester.textContent = "Semester " + course.semester;

    if(course.coverURL){
      cover.src = course.coverURL;
    }

    const isJoined = joinedCourses.has(course.id);

    if(isJoined){
      joinBtn.textContent = "Joined";
      joinBtn.disabled = true;
      locked.style.display = "none";
      pdfBtn.href = course.pdfURL;
    }else{

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
      dept: course.department || "Others",   // ✅ IMPORTANT FIX
      joinBtn
    };

    modal.classList.add("show");

  };

}

    container.appendChild(card);
  }

}
/* ================= RENDER COURSES ================= */

function renderCourses(){

  container.innerHTML="";

  if(!allCourses.length){
    container.innerHTML="<p>No courses uploaded yet.</p>";
    return;
  }

const latestCourses = [...allCourses]

.filter(course =>

  String(course.department || "")
    .trim()
    .toUpperCase() === userDepartment &&

  String(course.semester || "")
    .trim() === userSemester

)

.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
.slice(0,11);

const grouped = {};

  for(const course of latestCourses){

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


      if(course.coverURL){
        cover.src = course.coverURL;
      }else{
        cover.style.display = "none";
      }


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