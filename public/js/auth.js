import { auth, db } from "./firebase.js";
window.API = "https://smart-tutoring-system-ndjb.onrender.com";
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

function showMessage(message, type = "error") {

  const box = document.getElementById("formMessage");

  if (!box) return;

  box.innerText = message;
  box.className = "form-message " + type;
  box.style.display = "block";

}

/* ================= PASSWORD STRENGTH ================= */

const passwordInput = document.getElementById("studentPassword");
const strengthText = document.getElementById("passwordStrength");
/* ===== ROLE TAB SWITCH ===== */

const studentTab = document.getElementById("studentTab");
const teacherTab = document.getElementById("teacherTab");

const studentForm = document.getElementById("studentForm");
const teacherForm = document.getElementById("teacherForm");

let isTeacher = false;

if(studentTab && teacherTab){

  studentTab.onclick = () => {
    isTeacher = false;

    studentTab.classList.add("active");
    teacherTab.classList.remove("active");

    studentForm.style.display = "block";
    teacherForm.style.display = "none";
  };

  teacherTab.onclick = () => {
    isTeacher = true;

    teacherTab.classList.add("active");
    studentTab.classList.remove("active");

    studentForm.style.display = "none";
    teacherForm.style.display = "block";
  };

}

if (passwordInput && strengthText) {

  passwordInput.addEventListener("input", () => {

    const val = passwordInput.value;

    if (val.length < 6) {
      strengthText.innerText = "Weak password";
      strengthText.style.color = "red";
    }
    else if (/^(?=.*[A-Za-z])(?=.*\d)/.test(val)) {
      strengthText.innerText = "Medium password";
      strengthText.style.color = "orange";
    }
    else if (/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])/.test(val)) {
      strengthText.innerText = "Strong password";
      strengthText.style.color = "green";
    }

  });

}

/* ================= OTP TIMER ================= */

let otpTimer;
let resendCooldown = false;

function startOTPTimer() {

  const message = document.getElementById("formMessage");

  let time = 600;

  clearInterval(otpTimer);

  otpTimer = setInterval(() => {

    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    message.innerText =
      "OTP expires in " + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;

    time--;

    if (time <= 0) {

      clearInterval(otpTimer);
      message.innerText = "OTP expired. Request again.";

    }

  }, 1000);

}

/* ================= SEND OTP ================= */

window.sendOTP = async function () {

  if (resendCooldown) {
    showMessage("Please wait before requesting another OTP");
    return;
  }
let email;

if(isTeacher){
  email = document.getElementById("teacherEmail")?.value;
}else{
  email = document.getElementById("studentEmail")?.value;
}
  const btn = document.getElementById("sendOtpBtn");

  if (!email) {
    showMessage("Enter email first");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `Sending <span class="btn-spinner"></span>`;

  try {

    const res = await fetch(API + "/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {

      showMessage("OTP sent successfully", "success");

      document.getElementById("otpInput").style.display = "block";
      document.getElementById("verifyBtn").style.display = "block";

      startOTPTimer();

      resendCooldown = true;

      setTimeout(() => { resendCooldown = false }, 60000);

    } else {
      showMessage("Failed to send OTP");
    }

  } catch (err) {
    showMessage("Server error");
  }

  btn.disabled = false;
  btn.innerHTML = "Send OTP";

}

/* ================= VERIFY OTP + SIGNUP ================= */
window.verifyOTP = async function () {

  let teacherToggle = isTeacher;
  let teacherData = null;

  let email, password;

  if(isTeacher){
    email = document.getElementById("teacherEmail")?.value;
    password = document.getElementById("teacherPassword")?.value;
  }else{
    email = document.getElementById("studentEmail")?.value;
    password = document.getElementById("studentPassword")?.value;
  }

  const otp = document.getElementById("otpInput")?.value;

  let confirmPassword;

if(isTeacher){
  confirmPassword = document.getElementById("teacherConfirmPassword")?.value;
}else{
  confirmPassword = document.getElementById("studentConfirmPassword")?.value;
}

if(!email || !password){
  showMessage("Fill all required fields");
  return;
}

if(password.length < 6){
  showMessage("Password must be at least 6 characters");
  return;
}

if(password !== confirmPassword){
  showMessage("Passwords do not match");
  return;
}
if(isTeacher){

  const name = document.getElementById("name")?.value;
  const qualification = document.getElementById("qualification")?.value;
  const institution = document.getElementById("institution")?.value;
  const experience = document.getElementById("experience")?.value;
  const documentURL = document.getElementById("document")?.value;
  const message = document.getElementById("message")?.value;

  if(!name || !qualification || !institution || !experience || !documentURL){
    showMessage("Fill all teacher fields");
    return;
  }

  teacherData = {
    name,
    qualification,
    institution,
    experience,
    documentURL,
    message,
    email
  };
}

  if (!otp) {
    showMessage("Enter verification code");
    return;
  }

  try {

    const verify = await fetch(API + "/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });

    const result = await verify.json();

    if (!result.success) {
      showMessage("Invalid OTP");
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    let role = "student";

    if (email === "admin@smart.com") role = "admin";
if (teacherToggle) role = "pending_teacher";

    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      role,
      requestedAt: new Date()
    });
    if(teacherData){
  await setDoc(doc(db, "teacher_requests", userCred.user.uid), {
    ...teacherData,
    status: "pending",
    createdAt: new Date()
  });
   await fetch(API + "/notify-teacher-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(teacherData)
  });
}

    await fetch("/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: userCred.user.uid,
        role: role
      })
    });

    /* FORCE TOKEN REFRESH AFTER CLAIM SET */
    await auth.currentUser.getIdToken(true);

    const token = await auth.currentUser.getIdToken();

    if (role === "admin")
      window.location.href = `/admin.html?token=${token}`;

    else if (role === "teacher" || role === "pending_teacher")
      window.location.href = `/dashboard.html?token=${token}`;

    else
      window.location.href = `/dashboard.html?token=${token}`;

  } catch (err) {

 if(err.code === "auth/email-already-in-use"){
  showMessage("Email already registered");
}else{
console.error(err);

if(err.code === "auth/email-already-in-use"){
  showMessage("Email already registered");
}else if(err.code === "auth/invalid-email"){
  showMessage("Invalid email");
}else if(err.code === "auth/weak-password"){
  showMessage("Weak password (min 6 characters)");
}else{
  showMessage(err.message);
}
}

  }

}

/* ================= LOGIN ================= */

window.login = async function () {

  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;
  const loginBtn = document.getElementById("loginBtn");

  loginBtn.disabled = true;
  loginBtn.innerHTML = `Logging in <span class="btn-spinner"></span>`;

  try {

    await signInWithEmailAndPassword(auth, email, password);

    /* refresh token to get latest role */
    await auth.currentUser.getIdToken(true);

    const tokenResult = await auth.currentUser.getIdTokenResult();
    let role = tokenResult.claims.role;

    if (!role) {

      // check Firestore role if claim missing
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));

      if (userDoc.exists()) {
        role = userDoc.data().role;
      }

    }

    if (!role) role = "student";

    const token = await auth.currentUser.getIdToken();

    if (role === "admin")
      window.location.href = `/admin.html?token=${token}`;

    else if (role === "teacher")
      window.location.href = `/teacher.html?token=${token}`;

    else
      window.location.href = `/dashboard.html?token=${token}`;

  } catch (err) {

    loginBtn.disabled = false;
    loginBtn.innerHTML = "Login";

    if (err.code === "auth/invalid-credential")
      showMessage("Wrong email or password");
    else
      showMessage("Login failed");

  }

}

/* ================= LOGOUT ================= */

window.logout = async function () {

  await signOut(auth);
  window.location.href = "/login.html";

}

/* ================= UNIVERSAL ROLE GUARD ================= */

onAuthStateChanged(auth, async (user) => {

  const path = window.location.pathname;

  if (!user) {

    if (!path.includes("login") && !path.includes("signup"))
      window.location.href = "/login.html";

    return;

  }
  const token = await user.getIdToken();

  localStorage.setItem("token", token);
  localStorage.setItem("userEmail", user.email);
  if (!path.includes("login") && !path.includes("signup")) {

    const token = await user.getIdToken();

    const res = await fetch(`${path}?token=${token}`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (res.status === 403) {

      await auth.currentUser.getIdToken(true);

      const tokenResult = await auth.currentUser.getIdTokenResult();
      let role = tokenResult.claims.role;

      if (!role) role = "student";

      const token = await auth.currentUser.getIdToken();

      if (role === "admin")
        window.location.href = `/admin.html?token=${token}`;

      else if (role === "teacher" || role === "pending_teacher")
        window.location.href = `/teacher.html?token=${token}`;

      else
        window.location.href = `/dashboard.html?token=${token}`;

      return;
    }

  }

  /* ===== DASHBOARD LINK FIX ===== */

  const dashboardLink = document.getElementById("dashboardLink");

  if (dashboardLink) {

    let role = "student";

    try {

      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        role = userDoc.data().role;
      }

    } catch (err) {
      console.error("ROLE FETCH ERROR:", err);
    }

    const token = await user.getIdToken();

    if (role === "admin")
      dashboardLink.href = `/admin.html?token=${token}`;

    else if (role === "teacher")
      dashboardLink.href = `/teacher.html?token=${token}`;

    else
      dashboardLink.href = `/dashboard.html?token=${token}`;

  }

});