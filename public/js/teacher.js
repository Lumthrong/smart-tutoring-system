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

document.addEventListener("DOMContentLoaded", () => {

  const uploadForm = document.getElementById("uploadLectureForm");
  const courseContainer = document.getElementById("myLectures");
  const quizContainer = document.getElementById("teacherQuizzes");

  const chatBox = document.getElementById("chatBox");
  const closeBtn = document.getElementById("chatClose");
  const sendBtn = document.querySelector(".sendComment");
  const input = document.querySelector(".commentInput");

  /* ================= AUTH ================= */

  onAuthStateChanged(auth, (user) => {

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    loadMyCourses();
    loadMyQuizzes();

  });

  /* ================= CHAT CLOSE ================= */

  if(closeBtn && chatBox){
    closeBtn.onclick = ()=>{
      chatBox.classList.add("hidden");
    };
  }

  /* ================= SEND COMMENT ================= */

  if(sendBtn && input){

    sendBtn.onclick = async ()=>{

      if(!activeCourseId){
        alert("Open a course discussion first.");
        return;
      }

      const message = input.value.trim();
      if(!message) return;

      const userDoc = await getDoc(doc(db,"users",auth.currentUser.uid));
      const user = userDoc.data();

      await addDoc(collection(db,"course_comments"),{
        courseId: activeCourseId,
        userId: auth.currentUser.uid,
        userName: user.firstName || user.email,
        message: message,
        createdAt: new Date()
      });

      input.value = "";

    };

  }

  /* ================= UPLOAD COURSE ================= */

  if(uploadForm){

    uploadForm.addEventListener("submit", async (e) => {

      e.preventDefault();

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

      alert("Lecture uploaded");
      uploadForm.reset();

    });

  }


/* ================= LOAD COURSES ================= */

function loadMyCourses(){

  const q = query(
    collection(db,"courses"),
    where("uploadedBy","==",auth.currentUser.uid)
  );

  onSnapshot(q,(snapshot)=>{

    courseContainer.innerHTML="";

    snapshot.forEach(docSnap=>{

      const course = docSnap.data();
      const courseId = docSnap.id;

      const div=document.createElement("div");

      div.innerHTML=`
<p>
<strong>${course.course}</strong>
(${course.department} - Sem ${course.semester})
</p>

<button class="openDiscussion">Discussion</button>
<button class="createQuiz">Create Quiz</button>
<button class="deleteCourse">Delete</button>

<hr>
`;

      /* OPEN DISCUSSION */

      div.querySelector(".openDiscussion").onclick = ()=>{

        activeCourseId = courseId;

        loadComments(courseId);

        const chat = document.getElementById("chatBox");
        if(chat) chat.classList.remove("hidden");

      };

      /* CREATE QUIZ */

      div.querySelector(".createQuiz").onclick=()=>{
        window.location="createQuiz.html?course="+courseId;
      };

      /* DELETE COURSE */

      div.querySelector(".deleteCourse").onclick=async()=>{

        if(!confirm("Delete this course?")) return;

        try{
          await deleteDoc(doc(db,"courses",courseId));
        }catch(err){
          console.error(err);
          alert("Delete failed. Check Firestore permissions.");
        }

      };

      courseContainer.appendChild(div);

    });

  });

}


/* ================= LOAD COMMENTS ================= */

function loadComments(courseId){

 const list=document.querySelector(".commentList");

 const q = query(
  collection(db,"course_comments"),
  where("courseId","==",courseId),
  orderBy("createdAt","asc")
 );

 onSnapshot(q,(snap)=>{

   list.innerHTML="";

   snap.forEach(docSnap=>{

     const data=docSnap.data();

     const div=document.createElement("div");

     const role =
       data.userId === auth.currentUser.uid
       ? "teacher"
       : "student";

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


/* ================= LOAD QUIZZES ================= */

function loadMyQuizzes(){

 const q=query(
  collection(db,"quizzes"),
  where("createdBy","==",auth.currentUser.uid)
 );

 onSnapshot(q,async(snapshot)=>{

   quizContainer.innerHTML="";

   if(snapshot.empty){
     quizContainer.innerHTML="<p>No quizzes created yet.</p>";
     return;
   }

   for(const quizDoc of snapshot.docs){

     const quiz = quizDoc.data();

     let courseName="Unknown Course";

     if(quiz.courseId){
       const courseDoc=await getDoc(doc(db,"courses",quiz.courseId));
       if(courseDoc.exists()){
         courseName=courseDoc.data().course;
       }
     }

     const div=document.createElement("div");

     div.innerHTML=`
<p>
📝 <strong>${quiz.title}</strong><br>
<small>Course: ${courseName}</small>
</p>

<button class="editQuiz">Edit</button>
<button class="deleteQuiz">Delete</button>

<hr>
`;

     div.querySelector(".editQuiz").onclick=()=>{
       window.location="createQuiz.html?quiz="+quizDoc.id;
     };

     div.querySelector(".deleteQuiz").onclick=async()=>{

       if(!confirm("Delete this quiz?")) return;

       try{

         const questionQuery=query(
          collection(db,"quiz_questions"),
          where("quizId","==",quizDoc.id)
         );

         const questions=await getDocs(questionQuery);
         for(const q of questions.docs) await deleteDoc(q.ref);

         const resultQuery=query(
          collection(db,"quiz_results"),
          where("quizId","==",quizDoc.id)
         );

         const results=await getDocs(resultQuery);
         for(const r of results.docs) await deleteDoc(r.ref);

         await deleteDoc(doc(db,"quizzes",quizDoc.id));

         alert("Quiz deleted");

       }catch(err){
         console.error(err);
         alert("Delete failed. Firestore permission blocked.");
       }

     };

     quizContainer.appendChild(div);

   }

 });

}

});