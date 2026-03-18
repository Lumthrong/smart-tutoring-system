import { db, auth } from "./firebase.js";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const container = document.getElementById("bookContainer");
  const searchInput = document.getElementById("searchInput");
  const teacherAppContainer = document.getElementById("teacherApplications");
  
  // Announcement Elements
  const announceArea = document.getElementById("announceArea");
  const sendAnnounceBtn = document.getElementById("sendAnnounceBtn");

  // Stats Elements
  const totalUsersEl = document.getElementById("totalUsers");
  const totalTeachersEl = document.getElementById("totalTeachers");
  const totalLecturesEl = document.getElementById("totalLectures");

  let allCourses = [];

  /* ================= AUTH & STATS ================= */
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      const usersSnap = await getDocs(collection(db, "users"));
      if (totalUsersEl) totalUsersEl.textContent = usersSnap.size;

      const teacherQuery = query(collection(db, "users"), where("role", "==", "teacher"));
      const teacherSnap = await getDocs(teacherQuery);
      if (totalTeachersEl) totalTeachersEl.textContent = teacherSnap.size;

      const lecturesSnap = await getDocs(collection(db, "courses"));
      if (totalLecturesEl) totalLecturesEl.textContent = lecturesSnap.size;
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  });

  /* ================= ANNOUNCEMENT SYSTEM ================= */
  if (sendAnnounceBtn) {
    sendAnnounceBtn.onclick = async () => {
      const message = announceArea.value.trim();
      if (!message) {
        alert("Please enter a message.");
        return;
      }

      if (!confirm("Send this announcement to all users?")) return;

      try {
        sendAnnounceBtn.disabled = true;
        sendAnnounceBtn.textContent = "Sending...";

        // Fetch all users to send them the notification
        const usersSnap = await getDocs(collection(db, "users"));
        
        const promises = usersSnap.docs.map(userDoc => {
          return addDoc(collection(db, "notifications"), {
            userId: userDoc.id,
            message: `📢 Admin Announcement: ${message}`,
            read: false,
            createdAt: serverTimestamp(),
            type: "announcement"
          });
        });

        await Promise.all(promises);

        alert("Announcement sent successfully to all users!");
        announceArea.value = "";
      } catch (error) {
        console.error("Error sending announcement:", error);
        alert("Failed to send announcement.");
      } finally {
        sendAnnounceBtn.disabled = false;
        sendAnnounceBtn.textContent = "Send Announcement";
      }
    };
  }

  /* ================= TEACHER APPLICATIONS ================= */
  const teacherRequestQuery = query(collection(db, "teacher_requests"), where("status", "==", "pending"));
  
  onSnapshot(teacherRequestQuery, (snapshot) => {
    if (!teacherAppContainer) return;
    teacherAppContainer.innerHTML = "";

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "teacher-request";
      div.innerHTML = `
        <p><b>Name:</b> ${data.name}</p>
        <p><b>Email:</b> ${data.email}</p>
        <p><b>Institution:</b> ${data.institution}</p>
        <p><b>Document:</b> <a href="${data.document}" target="_blank">View File</a></p>
        <div class="request-actions">
          <button class="approve">Approve</button>
          <button class="reject">Reject</button>
        </div>
      `;

      div.querySelector(".approve").onclick = async () => {
        await updateDoc(doc(db, "users", data.userId), { role: "teacher" });
        await updateDoc(doc(db, "teacher_requests", docSnap.id), { status: "approved" });
        if (totalTeachersEl) totalTeachersEl.textContent = parseInt(totalTeachersEl.textContent) + 1;
      };

      div.querySelector(".reject").onclick = async () => {
        await updateDoc(doc(db, "teacher_requests", docSnap.id), { status: "rejected" });
      };

      teacherAppContainer.appendChild(div);
    });
  });

  /* ================= COURSE MANAGEMENT ================= */
  onSnapshot(collection(db, "courses"), (snapshot) => {
    allCourses = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    renderCourses(allCourses);
  });

  /* ================= SEARCH LOGIC ================= */
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const keyword = searchInput.value.toLowerCase();
      const filtered = allCourses.filter(course => 
        course.course.toLowerCase().includes(keyword) || 
        (course.department && course.department.toLowerCase().includes(keyword))
      );
      renderCourses(filtered);
    });
  }

  /* ================= RENDERING ENGINE ================= */
  function renderCourses(courses) {
    if (!container) return;
    container.innerHTML = courses.length ? "" : "<p>No courses found.</p>";

    const grouped = {};
    courses.forEach(course => {
      const dept = course.department || "Other";
      const sem = course.semester || "N/A";
      if (!grouped[dept]) grouped[dept] = {};
      if (!grouped[dept][sem]) grouped[dept][sem] = [];
      grouped[dept][sem].push(course);
    });

    Object.keys(grouped).sort().forEach(dept => {
      const deptHeader = document.createElement("h3");
      deptHeader.textContent = "📁 " + dept;
      container.appendChild(deptHeader);

      Object.keys(grouped[dept]).sort().forEach(sem => {
        const semHeader = document.createElement("h4");
        semHeader.textContent = "📂 Semester " + sem;
        container.appendChild(semHeader);

        grouped[dept][sem].forEach(course => {
          const div = document.createElement("div");
          div.className = "course-item";
          div.innerHTML = `
            <span>📄 ${course.course}</span>
            <div class="item-links">
              <a href="${course.pdfURL}" target="_blank">View PDF</a>
              <button class="delete-btn">Delete</button>
            </div>
          `;

          div.querySelector(".delete-btn").onclick = async () => {
            if (confirm(`Are you sure you want to delete ${course.course}?`)) {
              await deleteDoc(doc(db, "courses", course.id));
            }
          };
          container.appendChild(div);
        });
      });
    });
  }
});