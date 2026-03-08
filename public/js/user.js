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
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let chartInstance = null;
let activeCourseId = null;

document.addEventListener("DOMContentLoaded", () => {

  loadProgressChart();

  const courseSelect = document.getElementById("courseSelect");

  /* COURSE SWITCH COMMENTS */



  onAuthStateChanged(auth, (user) => {

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    loadCourses(user.uid);

  });

});


/* ================= LOAD COURSES ================= */

async function loadCourses(uid) {

  const enrollQuery = query(
    collection(db,"enrollments"),
    where("userId","==",uid)
  );

  const enrolledDiv = document.getElementById("enrolledCourses");
  const courseSelect = document.getElementById("courseSelect");

  onSnapshot(enrollQuery, async(snapshot)=>{

    enrolledDiv.innerHTML="";
    courseSelect.innerHTML="";

    for(const enrollDoc of snapshot.docs){

      const courseId = enrollDoc.data().courseId;

      const courseDoc = await getDoc(doc(db,"courses",courseId));

      if(!courseDoc.exists()) continue;

      const data = courseDoc.data();

      const option=document.createElement("option");
      option.value=courseId;
      option.textContent=data.course;

      courseSelect.appendChild(option);

      /* load comments only for first course */

      if(courseSelect.options.length === 1){
        loadComments(courseId);
      }

      const quizQuery=query(
        collection(db,"quizzes"),
        where("courseId","==",courseId)
      );

      const quizSnap=await getDocs(quizQuery);

      let quizButton="";

      if(!quizSnap.empty){
        quizButton=`<button class="quizBtn">Take Quiz</button>`;
      }

      const div=document.createElement("div");

div.innerHTML=`
<p>
<strong>${data.course}</strong>
(${data.department} - Sem ${data.semester})
</p>

${data.pdfURL ?
`<a href="${data.pdfURL}" target="_blank">📄 View PDF</a>`:""}

<br><br>

${data.videoURL ?
`<video width="350" controls>
<source src="${data.videoURL}">
</video>`:""}

<br><br>

<button class="discussionBtn">💬 Discussion</button>

${quizButton}

<hr>
`;
div.querySelector(".discussionBtn").onclick = ()=>{

  activeCourseId = courseId;

  loadComments(courseId);

  const chat = document.getElementById("chatBox");
  chat.classList.remove("hidden");

};
      if(!quizSnap.empty){
        div.querySelector(".quizBtn").onclick=()=>{
          startTeacherQuiz(courseId);
        };
      }

      enrolledDiv.appendChild(div);

    }

  });

}


/* ================= START QUIZ ================= */

async function startTeacherQuiz(courseId){

 const quizQuery=query(
   collection(db,"quizzes"),
   where("courseId","==",courseId)
 );

 const quizSnap=await getDocs(quizQuery);

 if(quizSnap.empty){
   alert("No quiz available");
   return;
 }

 const quizDoc=quizSnap.docs[0];
 const quizId=quizDoc.id;
 const quizData=quizDoc.data();

 const resultId=auth.currentUser.uid+"_"+quizId;

 const resultSnap=await getDoc(doc(db,"quiz_results",resultId));

 if(resultSnap.exists()){
   alert("You already attempted this quiz");
   return;
 }

 const questionQuery=query(
   collection(db,"quiz_questions"),
   where("quizId","==",quizId)
 );

 const questionSnap=await getDocs(questionQuery);

 const questions=questionSnap.docs.map(d=>d.data());

 renderQuiz(questions,quizId,quizData);

}


/* ================= QUICK AI QUIZ ================= */

window.startTest = async function(){

 const courseSelect=document.getElementById("courseSelect");

 if(!courseSelect.value){
   alert("Select a course first");
   return;
 }

 const courseId=courseSelect.value;

 const courseDoc=await getDoc(doc(db,"courses",courseId));

 if(!courseDoc.exists()){
   alert("Course not found");
   return;
 }

 const courseData=courseDoc.data();

 try{

   const res=await fetch("/generate-test",{
     method:"POST",
     headers:{ "Content-Type":"application/json" },
     body:JSON.stringify({
       pdfURL:courseData.pdfURL
     })
   });

   const data=await res.json();

   if(!data.questions){
     console.error(data);
     alert("AI failed to generate quiz");
     return;
   }

   renderQuiz(data.questions,"aiQuiz",{
     title:"Quick Quiz",
     timeLimit:5
   });

 }catch(err){

   console.error(err);
   alert("AI quiz failed");

 }

};


/* ================= RENDER QUIZ ================= */

function renderQuiz(questions,quizId,quizData){

 const dashboard=document.querySelector(".dashboard");

 const container=document.createElement("div");
 container.className="card";

 container.innerHTML=`
 <h3>${quizData.title}</h3>
 ${quizId !== "aiQuiz" ? `<div id="timer"></div>` : ""}
 `;

 dashboard.prepend(container);

 if(quizId !== "aiQuiz" && quizData.timeLimit){
   startTimer(quizData.timeLimit);
 }

 questions.forEach((q,i)=>{

 const div=document.createElement("div");

 div.innerHTML=`<p><b>${i+1}. ${q.question}</b></p>`;

 q.options.forEach(opt=>{
 div.innerHTML+=`
 <label>
 <input type="radio" name="q${i}" value="${opt}">
 ${opt}
 </label><br>
 `;
 });

 container.appendChild(div);

 });

 const submit=document.createElement("button");
 submit.innerText="Submit Quiz";

 submit.onclick=async()=>{

 let score=0;

 questions.forEach((q,i)=>{

 const selected=document.querySelector(`input[name="q${i}"]:checked`);

 if(selected && selected.value===q.answer){
 score++;
 }

 });

 const percent=(score/questions.length)*100;

 if(quizId!=="aiQuiz"){

 const resultId=auth.currentUser.uid+"_"+quizId;

 const userDoc=await getDoc(doc(db,"users",auth.currentUser.uid));
 const userData=userDoc.data();

 const studentName=(userData.firstName||"")+" "+(userData.lastName||"");

 await setDoc(doc(db,"quiz_results",resultId),{
 userId:auth.currentUser.uid,
 studentName:studentName.trim(),
 quizId,
 score:percent,
 submittedAt:new Date()
 });

 }

 alert("Score: "+percent+"%");

 };

 container.appendChild(submit);

}


/* ================= TIMER ================= */

let quizTimer;

function startTimer(minutes){

 let time=minutes*60;

 const timer=document.getElementById("timer");

 quizTimer=setInterval(()=>{

 time--;

 const m=Math.floor(time/60);
 const s=time%60;

 timer.innerText=`Time: ${m}:${s}`;

 if(time<=0){
 clearInterval(quizTimer);
 alert("Time up!");
 }

 },1000);

}


/* ================= PROGRESS CHART ================= */

function loadProgressChart(){

 const canvas=document.getElementById("progressChart");

 if(!canvas) return;

 const ctx=canvas.getContext("2d");

 chartInstance=new Chart(ctx,{
 type:"bar",
 data:{
 labels:["Week 1","Week 2","Week 3","Week 4"],
 datasets:[{
 label:"Study Progress",
 data:[5,10,15,20],
 backgroundColor:"#4f46e5"
 }]
 }
 });

}


/* ================= COURSE COMMENTS ================= */

async function loadComments(courseId){

 const q = query(
  collection(db,"course_comments"),
  where("courseId","==",courseId),
  orderBy("createdAt","asc")
);
 const list=document.querySelector(".commentList");

 onSnapshot(q,(snap)=>{

   list.innerHTML="";

   snap.forEach(docSnap=>{

     const data=docSnap.data();

     const div=document.createElement("div");

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
  const courseId = activeCourseId;

 if(!input.value.trim()) return;

  const userDoc = await getDoc(doc(db,"users",auth.currentUser.uid));
  const user = userDoc.data();

  await addDoc(collection(db,"course_comments"),{

    courseId,
    userId: auth.currentUser.uid,
    userName: user.firstName || user.email,
    message: input.value,
    createdAt: new Date()

  });

  input.value = "";

  /* notify teacher */

  const courseDoc = await getDoc(doc(db,"courses",courseId));
  const courseData = courseDoc.data();

  await addDoc(collection(db,"notifications"),{

    role: "teacher",
    userId: courseData.uploadedBy,
    message: `💬 New student question in ${courseData.course}`,
    link: "teacherDashboard.html",
    read: false,
    createdAt: new Date()

  });

};


/* ================= CHAT TOGGLE ================= */

const chatBox = document.getElementById("chatBox");
const closeBtn = document.getElementById("chatClose");

if(chatBox && closeBtn){
  closeBtn.onclick = ()=>{
    chatBox.classList.add("hidden");
  };
}