const urlParams = new URLSearchParams(window.location.search);
const pageToken = urlParams.get("token");

if(pageToken){
  localStorage.setItem("authToken",pageToken);
}
import { auth, db } from "./firebase.js";
document.addEventListener("DOMContentLoaded",()=>{

  const otpInput = document.getElementById("otpInput");
  const verifyBtn = document.getElementById("verifyBtn");

  if(otpInput) otpInput.style.display = "none";
  if(verifyBtn) verifyBtn.style.display = "none";

});
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

const passwordInput = document.getElementById("password");
const strengthText = document.getElementById("passwordStrength");

passwordInput.addEventListener("input", () => {

  const val = passwordInput.value;

  if(val.length < 6){
    strengthText.innerText = "Weak password";
    strengthText.style.color = "red";
  }
  else if(/^(?=.*[A-Za-z])(?=.*\d)/.test(val)){
    strengthText.innerText = "Medium password";
    strengthText.style.color = "orange";
  }
  else if(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])/.test(val)){
    strengthText.innerText = "Strong password";
    strengthText.style.color = "green";
  }
});
let otpTimer;
let resendCooldown = false;
function startOTPTimer(){

  const message = document.getElementById("formMessage");

  let time = 600; // 10 minutes

  clearInterval(otpTimer);

  otpTimer = setInterval(()=>{

    const minutes = Math.floor(time/60);
    const seconds = time%60;

    message.innerText =
      "OTP expires in " + minutes + ":" + (seconds<10?"0":"") + seconds;

    time--;

    if(time <= 0){

      clearInterval(otpTimer);
      message.innerText = "OTP expired. Request again.";

    }

  },1000);

}
/* ================= SEND OTP ================= */

window.sendOTP = async function () {
if(resendCooldown){
  showMessage("Please wait before requesting another OTP");
  return;
}
  const email = document.getElementById("email").value;
  const btn = document.getElementById("sendOtpBtn");

  if (!email) {
    showMessage("Enter email first");
    return;
  }

  /* ===== SHOW SPINNER ===== */

  btn.disabled = true;
  btn.innerHTML = `Sending <span class="btn-spinner"></span>`;

  try{

    const res = await fetch("/send-otp",{
      method:"POST",
      headers:{ "Content-Type":"application/json"},
      body:JSON.stringify({email})
    });

    const data = await res.json();

if(data.success){

  showMessage("OTP sent successfully","success");

  document.getElementById("otpInput").style.display="block";
  document.getElementById("verifyBtn").style.display="block";

  startOTPTimer();

  resendCooldown = true;

  setTimeout(()=>{
    resendCooldown = false;
  },60000);

}else{
      showMessage("Failed to send OTP");
    }

  }catch(err){
    showMessage("Server error");
  }

  /* ===== RESTORE BUTTON ===== */

  btn.disabled = false;
  btn.innerHTML = "Send OTP";

};


/* ================= VERIFY OTP + SIGNUP ================= */

window.verifyOTP = async function () {

  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;
  const otp = document.getElementById("otpInput")?.value;
  if(!otp || otp.trim() === ""){
  showMessage("Please enter the verification code");
  return;
}
  const teacherRequest = document.getElementById("teacherRequest")?.checked;
const verifyBtn = document.getElementById("verifyBtn");

verifyBtn.disabled = true;
verifyBtn.innerHTML = `Verifying <span class="btn-spinner"></span>`;
  const passwordRegex =
/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

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

  verifyBtn.disabled = false;
  verifyBtn.innerHTML = "Verify & Sign Up";

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
    await fetch("/set-role",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({
    uid: userCred.user.uid,
    role: role
  })
});

await auth.currentUser.getIdToken(true);
    showMessage("Account created successfully","success");

    setTimeout(()=>{
      window.location.href="dashboard.html";
    },1500);

}catch(err){
  showMessage(err.message);

  verifyBtn.disabled = false;
  verifyBtn.innerHTML = "Verify & Sign Up";
}

};


/* ================= LOGIN ================= */

window.login = async function(){

  const email=document.getElementById("email")?.value;
  const password=document.getElementById("password")?.value;
  const loginBtn = document.getElementById("loginBtn");

  loginBtn.disabled = true;
  loginBtn.innerHTML = `Logging in <span class="btn-spinner"></span>`;

  try{

    const userCred = await signInWithEmailAndPassword(auth,email,password);

const tokenResult = await auth.currentUser.getIdTokenResult(true);
const token = tokenResult.token;

const role = tokenResult.claims.role || "student";

if(role==="admin")
  window.location.href="/adminDashboard.html?token="+token;

else if(role==="teacher")
  window.location.href="/teacherDashboard.html?token="+token;

else
  window.location.href="/dashboard.html?token="+token;

  }catch(err){

    loginBtn.disabled = false;
    loginBtn.innerHTML = "Login";

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
  const dashboardLink = document.getElementById("dashboardLink");

  /* ===== NOT LOGGED IN ===== */

  if (!user) {

    if (!path.includes("login") && !path.includes("signup")) {
      window.location.href = "login.html";
    }

    return;
  }

  /* ===== GET USER ROLE ===== */

  const tokenResult = await user.getIdTokenResult();
const role = tokenResult.claims.role || "student";

  /* ================= DASHBOARD LINK FIX ================= */

  if (dashboardLink) {

    if (role === "admin")
      dashboardLink.href = "adminDashboard.html";

    else if (role === "teacher")
      dashboardLink.href = "teacherDashboard.html";

    else
      dashboardLink.href = "dashboard.html";

  }

  /* ================= PAGE ROLE GUARD ================= */

  const pageRole = document.body.dataset.role;

  if (pageRole && pageRole !== role) {

    if (role === "admin")
      window.location.href = "adminDashboard.html";

    else if (role === "teacher")
      window.location.href = "teacherDashboard.html";

    else
      window.location.href = "dashboard.html";
  }

}); 