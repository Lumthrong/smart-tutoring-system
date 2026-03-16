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
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


document.addEventListener("DOMContentLoaded", () => {

  const uploadForm = document.getElementById("uploadForm");
  const container = document.getElementById("bookContainer");
  const searchInput = document.getElementById("searchInput");
  const pendingContainer = document.getElementById("pendingTeachers");
  const teacherAppContainer = document.getElementById("teacherApplications");

  const totalUsersEl = document.getElementById("totalUsers");
  const totalTeachersEl = document.getElementById("totalTeachers");
  const totalLecturesEl = document.getElementById("totalLectures");

  let allCourses = [];

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    /* ================= STATS ================= */

    const usersSnap = await getDocs(collection(db, "users"));
    totalUsersEl.textContent = usersSnap.size;

    const teacherQuery = query(
      collection(db, "users"),
      where("role", "==", "teacher")
    );
    const teacherSnap = await getDocs(teacherQuery);
    totalTeachersEl.textContent = teacherSnap.size;

    const lecturesSnap = await getDocs(collection(db, "courses"));
totalLecturesEl.textContent = lecturesSnap.size;


    /* ================= PENDING TEACHERS ================= */

   /* ================= PENDING TEACHERS ================= */

const pendingQuery = query(
  collection(db, "users"),
  where("role", "==", "pending_teacher")
);

const pendingSnap = await getDocs(pendingQuery);
pendingContainer.innerHTML = "";

pendingSnap.forEach(docSnap => {

  const data = docSnap.data();

  const div = document.createElement("div");
  div.className = "pending-item";

  div.innerHTML = `
    <span>${data.email}</span>

    <div class="pending-actions">
      <button class="approve-btn">Approve</button>
      <button class="reject-btn">Reject</button>
    </div>
  `;

  /* ===== APPROVE ===== */

  div.querySelector(".approve-btn")
  .addEventListener("click", async () => {

    await updateDoc(doc(db, "users", docSnap.id), {
      role: "teacher"
    });

    div.remove();

    totalTeachersEl.textContent =
      parseInt(totalTeachersEl.textContent) + 1;

  });

  /* ===== REJECT ===== */

  div.querySelector(".reject-btn")
  .addEventListener("click", async () => {

    await updateDoc(doc(db, "users", docSnap.id), {
      role: "student"
    });

    div.remove();

  });

  pendingContainer.appendChild(div);

});

/* ================= TEACHER APPLICATIONS ================= */

const teacherRequestQuery = query(collection(db,"teacher_requests"));

onSnapshot(teacherRequestQuery,(snapshot)=>{

teacherAppContainer.innerHTML="";

snapshot.forEach(docSnap=>{

const data = docSnap.data();

if(data.status !== "pending") return;

const div = document.createElement("div");
div.className="teacher-request";

div.innerHTML = `

<p><b>Name:</b> ${data.name}</p>
<p><b>Email:</b> ${data.email}</p>
<p><b>Qualification:</b> ${data.qualification}</p>
<p><b>Institution:</b> ${data.institution}</p>
<p><b>Experience:</b> ${data.experience}</p>

<p>
<b>Document:</b>
<a href="${data.document}" target="_blank">View Document</a>
</p>

<div class="request-actions">
<button class="approve">Approve</button>
<button class="reject">Reject</button>
</div>

`;

/* APPROVE */

div.querySelector(".approve").onclick = async ()=>{

await updateDoc(doc(db,"users",data.userId),{
role:"teacher"
});

await updateDoc(doc(db,"teacher_requests",docSnap.id),{
status:"approved"
});

div.remove();

};

/* REJECT */

div.querySelector(".reject").onclick = async ()=>{

await updateDoc(doc(db,"teacher_requests",docSnap.id),{
status:"rejected"
});

div.remove();

};

teacherAppContainer.appendChild(div);

});

});
    /* ================= COURSE UPLOAD ================= */

uploadForm.addEventListener("submit", async (e) => {

  e.preventDefault();

  try {

    const user = auth.currentUser;

    if (!user) {
      alert("You are not authenticated.");
      return;
    }

    const formData = new FormData(uploadForm);

    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error("Server error: " + errorText);
    }

    const data = await res.json();

    console.log("Upload server response:", data);

    // 🔥 Ensure Firestore write is authenticated
    await addDoc(collection(db, "courses"), {
      department: data.department,
      semester: data.semester,
      course: data.course,
      pdfURL: data.pdfURL || null,
      pdfFilename: data.pdfFilename || null,
      videoURL: data.videoURL || null,
      videoFilename: data.videoFilename || null,
      createdAt: new Date(),
      uploadedBy: user.uid
    });

    alert("Upload successful!");
    uploadForm.reset();

  } catch (error) {
    console.error("UPLOAD FAILED:", error);
    alert(error.message);
  }

});

    /* ================= REAL-TIME COURSE LOAD ================= */

    onSnapshot(collection(db, "courses"), (snapshot) => {

      allCourses = [];

      snapshot.forEach(docSnap => {
        allCourses.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      renderCourses(allCourses);
    });

  });


  /* ================= SEARCH ================= */

  searchInput.addEventListener("input", () => {

    const keyword = searchInput.value.toLowerCase();

    const filtered = allCourses.filter(course =>
      course.course.toLowerCase().includes(keyword)
    );

    renderCourses(filtered);
  });


  /* ================= GROUPED RENDER ================= */

  function renderCourses(courses) {

    container.innerHTML = "";

    const grouped = {};

    courses.forEach(course => {

      if (!grouped[course.department])
        grouped[course.department] = {};

      if (!grouped[course.department][course.semester])
        grouped[course.department][course.semester] = [];

      grouped[course.department][course.semester].push(course);
    });

    Object.keys(grouped).forEach(dept => {

      const deptHeader = document.createElement("h3");
      deptHeader.textContent = "📁 " + dept;
      container.appendChild(deptHeader);

      Object.keys(grouped[dept]).forEach(sem => {

        const semHeader = document.createElement("h4");
        semHeader.textContent = "📂 Semester " + sem;
        container.appendChild(semHeader);

        grouped[dept][sem].forEach(course => {

  const div = document.createElement("div");

  let content = `
    📄 ${course.course}
    <a href="${course.pdfURL}" target="_blank">View PDF</a>
  `;

  if (course.videoURL) {
    content += `
      <br>
      🎥 Video Lecture:
      <br>
      <video width="300" controls>
        <source src="${course.videoURL}">
      </video>
    `;
  }

  div.innerHTML = `
    ${content}
    <br>
    <button>Delete</button>
  `;

  div.querySelector("button")
    .addEventListener("click", async () => {

      if (!confirm("Delete this course?")) return;

      if (course.pdfFilename)
        await fetch(`/delete-course/${course.pdfFilename}`, { method: "DELETE" });

      if (course.videoFilename)
        await fetch(`/delete-course/${course.videoFilename}`, { method: "DELETE" });

      await deleteDoc(doc(db, "courses", course.id));
    });

  container.appendChild(div);
});

      });

    });

  }

});