import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* ================= MESSAGE FUNCTION ================= */

function showMessage(text,type="error"){

  const box=document.getElementById("msgBox");

  if(!box) return;

  box.innerText=text;
  box.className="msg "+type;
  box.style.display="block";

  setTimeout(()=>{
    box.style.display="none";
  },4000);
}


/* ================= ADD QUESTION ================= */

window.addQuestion=function(){

  const container=document.getElementById("questions");

  const div=document.createElement("div");
  div.className="question-block";

  div.innerHTML=`
    <input class="qText" placeholder="Question">

    <input class="optA" placeholder="Option A">
    <input class="optB" placeholder="Option B">
    <input class="optC" placeholder="Option C">
    <input class="optD" placeholder="Option D">

    <input class="answer" placeholder="Correct Answer">

    <hr>
  `;

  container.appendChild(div);

};


/* ================= SAVE QUIZ ================= */

window.saveQuiz=async function(){

  try{

    const courseId=new URLSearchParams(location.search).get("course");

    if(!courseId){
      showMessage("Course not found in URL");
      return;
    }

    const title=document.getElementById("quizTitle").value.trim();
    const timeLimit=document.getElementById("timeLimit").value;

    if(!title){
      showMessage("Enter quiz title");
      return;
    }

    const blocks=document.querySelectorAll(".question-block");

    if(blocks.length===0){
      showMessage("Add at least one question");
      return;
    }

    /* ================= CREATE QUIZ ================= */

    const quizRef=await addDoc(collection(db,"quizzes"),{
      courseId,
      title,
      timeLimit,
      teacherEmail:
  auth.currentUser.email.toLowerCase(),
      createdBy:auth.currentUser.uid,
      createdAt:new Date()
    });

    console.log("Quiz created:",quizRef.id);


    /* ================= SAVE QUESTIONS ================= */

    for(const block of blocks){

      const question=block.querySelector(".qText").value.trim();
      const optA=block.querySelector(".optA").value.trim();
      const optB=block.querySelector(".optB").value.trim();
      const optC=block.querySelector(".optC").value.trim();
      const optD=block.querySelector(".optD").value.trim();
      const answer=block.querySelector(".answer").value.trim();

      if(!question || !optA || !optB || !optC || !optD || !answer){

        console.warn("Missing question fields",{
          question,optA,optB,optC,optD,answer
        });

        showMessage("All question fields must be filled");
        return;
      }

      await addDoc(collection(db,"quiz_questions"),{
        quizId:quizRef.id,
        question,
        options:[optA,optB,optC,optD],
        answer
      });

    }

    console.log("Questions saved");


    /* ================= SEND NOTIFICATIONS ================= */

    const enrollQuery=query(
      collection(db,"enrollments"),
      where("courseId","==",courseId)
    );

    const snap=await getDocs(enrollQuery);

    for(const docSnap of snap.docs){

      const data=docSnap.data();

      if(!data.userId) continue;

      await addDoc(collection(db,"notifications"),{

        userId:data.userId,
        message:`📢 New quiz available: ${title}`,
        link:`quiz.html?quiz=${quizRef.id}`,
        read:false,
        createdAt:new Date()

      });

    }

    showMessage("Quiz created successfully","success");

    setTimeout(()=>{
      window.location.href="teacher.html";
    },1500);

  }
  catch(err){

    console.error("QUIZ CREATION ERROR:",err);

    showMessage("Question creation failed. Check console.");

  }

};