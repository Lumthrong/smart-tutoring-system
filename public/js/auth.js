import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= MESSAGE SYSTEM ================= */

function showMessage(message,type="error"){

  const box=document.getElementById("formMessage");

  if(!box) return;

  box.innerText=message;
  box.className="form-message "+type;
  box.style.display="block";

}


/* ================= SEND OTP ================= */

window.sendOTP = async function () {

  const email = document.getElementById("email")?.value;

  if (!email) {
    showMessage("Enter email first");
    return;
  }

  showMessage("Sending OTP...","success");

  try{

    const res = await fetch("/send-otp", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if(data.success)
      showMessage("OTP sent to your email","success");
    else
      showMessage("Failed to send OTP");

  }catch(err){
    showMessage("Server error while sending OTP");
  }

};


/* ================= VERIFY OTP + SIGNUP ================= */

window.verifyOTP = async function () {

  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;
  const otp = document.getElementById("otpInput")?.value;
  const teacherRequest = document.getElementById("teacherRequest")?.checked;

  const passwordRegex = /^[a-zA-Z0-9@#$%^&*!]{6,}$/;

  if(!passwordRegex.test(password)){
    showMessage("Password must be at least 6 characters");
    return;
  }

  if(password !== confirmPassword){
    showMessage("Passwords do not match");
    return;
  }

  try{

    const verify = await fetch("/verify-otp", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, otp })
    });

    const result = await verify.json();

    if(!result.success){
      showMessage("Invalid OTP");
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth,email,password);

    let role="student";

    if(email==="admin@smart.com")
      role="admin";

    if(teacherRequest)
      role="pending_teacher";

    await setDoc(doc(db,"users",userCred.user.uid),{
      email,
      role,
      requestedAt:new Date()
    });

    showMessage("Account created successfully","success");

    setTimeout(()=>{
      window.location.href="dashboard.html";
    },1500);

  }catch(err){
    showMessage(err.message);
  }

};


/* ================= LOGIN ================= */

window.login = async function(){

  const email=document.getElementById("email")?.value;
  const password=document.getElementById("password")?.value;

  try{

    const userCred=await signInWithEmailAndPassword(auth,email,password);
    const uid=userCred.user.uid;

    const snap=await getDoc(doc(db,"users",uid));

    if(!snap.exists()){
      showMessage("User profile missing");
      return;
    }

    const role=snap.data().role;

    if(role==="admin")
      window.location.href="adminDashboard.html";
    else if(role==="teacher")
      window.location.href="teacherDashboard.html";
    else
      window.location.href="dashboard.html";

  }catch(err){

    if(err.code === "auth/invalid-credential"){
      showMessage("Wrong email or password");
    }
    else{
      showMessage("Login failed");
    }

  }

};


/* ================= LOGOUT ================= */

window.logout=async function(){

  await signOut(auth);
  window.location.href="login.html";

};


/* ================= UNIVERSAL ROLE GUARD ================= */

onAuthStateChanged(auth, async (user) => {

  const path = window.location.pathname;

  // Not logged in
  if (!user) {

    if (!path.includes("login") && !path.includes("signup"))
      window.location.href = "login.html";

    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) return;

  const userRole = snap.data().role;

  /* ===== PAGE ROLE REQUIREMENT ===== */

  const pageRole = document.body.dataset.role;

  if (pageRole && pageRole !== userRole) {

    // Redirect user to their correct dashboard

    if (userRole === "admin")
      window.location.href = "adminDashboard.html";

    else if (userRole === "teacher")
      window.location.href = "teacherDashboard.html";

    else
      window.location.href = "dashboard.html";
  }

});
/* ================= DASHBOARD LINK FIX ================= */

onAuthStateChanged(auth, async (user) => {

  const dashboardLink = document.getElementById("dashboardLink");

  if (!user || !dashboardLink) return;

  const snap = await getDoc(doc(db,"users",user.uid));
  const role = snap.data().role;

  if(role === "admin")
    dashboardLink.href = "adminDashboard.html";

  else if(role === "teacher")
    dashboardLink.href = "teacherDashboard.html";

  else
    dashboardLink.href = "dashboard.html";

});
