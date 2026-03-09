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


document.addEventListener("DOMContentLoaded", () => {

  const container = document.getElementById("departmentSections");
  const searchInput = document.getElementById("courseSearch");

  if (!container) return;

  let currentUser = null;
  let allCourses = [];
  let joinedCourses = new Set();
  let searchTerm = "";

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

        const isJoined=joinedCourses.has(course.id);

        const card=document.createElement("div");
        card.className="book-card";

        card.innerHTML=`
          <h3>${course.course}</h3>
          <p>Semester ${course.semester}</p>

          ${isJoined ? `
            <a href="${course.pdfURL}" target="_blank" class="pdf-btn">
              View PDF
            </a>

            ${course.videoURL ? `
              <video width="100%" controls>
                <source src="${course.videoURL}">
              </video>
            ` : ""}

          ` : `
            <div class="locked">
              🔒 Join to access materials
            </div>
          `}

          <button class="join-btn">
            ${isJoined ? "Joined" : "Join Course"}
          </button>
        `;

        const joinBtn=card.querySelector(".join-btn");


        if(!isJoined){

          joinBtn.addEventListener("click", async ()=>{

            const user=auth.currentUser;

            if(!user){
              alert("Login first.");
              return;
            }

            const confirmJoin=confirm(`Join ${course.course}?`);

            if(!confirmJoin) return;

            await addDoc(collection(db,"enrollments"),{

              userId:user.uid,
              courseId:course.id,
              courseName:course.course,
              department:dept,
              joinedAt:new Date()

            });

            joinedCourses.add(course.id);

            renderCourses();

          });

        }else{

          joinBtn.disabled=true;

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