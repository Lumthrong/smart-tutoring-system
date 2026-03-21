import { db, auth } from "./firebase.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  getDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {

  const bell = document.querySelector(".notify");
  const panel = document.getElementById("notificationPanel");

  if (!bell || !panel) return;

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    panel.classList.remove("show");
  });

});


/* ================= LOAD NOTIFICATIONS ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  const badge = document.getElementById("notifyCount");
  const panel = document.getElementById("notificationPanel");

  if (!panel) return;

  /* ===== GET USER ROLE ===== */

  const userDoc = await getDoc(doc(db, "users", user.uid));

  let role = "student";
  if (userDoc.exists()) {
    role = userDoc.data().role;
  }

  /* ================= ADMIN: TEACHER REQUEST ================= */

  if (role === "admin") {

    const requestQuery = query(
      collection(db, "teacher_requests"),
      orderBy("createdAt", "desc")
    );

    onSnapshot(requestQuery, (snapshot) => {

      panel.innerHTML = "";

      let unreadCount = 0;
      let total = 0;

      if (snapshot.empty) {
        panel.innerHTML = "<p>No notifications</p>";
      }

      snapshot.forEach(docSnap => {

        const data = docSnap.data();
        total++;

        const div = document.createElement("div");
        div.className = "notificationItem";

        if (!data.read) {
          div.classList.add("unread");
          unreadCount++;
        }

        div.innerHTML = `
          <p>🧑‍🏫 ${data.name} requested teacher access</p>
          <small>${formatTime(data.createdAt)}</small>
        `;

        div.onclick = async () => {

          try {
            await updateDoc(doc(db, "teacher_requests", docSnap.id), {
              read: true
            });
          } catch (err) {
            console.error("Mark read failed:", err);
          }

          const token = localStorage.getItem("token");

          if (!token) {
            window.location.href = "login.html";
            return;
          }

          window.location.href = `admin.html?token=${token}`;
        };

        panel.appendChild(div);

      });

      /* ✅ SHOW "NO NEW" */
      if (total > 0 && unreadCount === 0) {
        panel.innerHTML = "<p>No new notifications</p>";
      }

      /* ✅ BADGE */
      if (badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? "inline-block" : "none";
      }

    });

    return;
  }


  /* ================= STUDENT: QUIZ NOTIFICATIONS ================= */

  const enrollSnap = await getDocs(
    query(
      collection(db, "enrollments"),
      where("userId", "==", user.uid)
    )
  );

  const courseIds = enrollSnap.docs.map(d => d.data().courseId);

  if (courseIds.length === 0) {
    panel.innerHTML = "<p>No notifications</p>";
    return;
  }

  /* ===== COURSE MAP ===== */

  const courseSnap = await getDocs(collection(db, "courses"));

  const courseMap = {};
  courseSnap.forEach(doc => {
    courseMap[doc.id] = doc.data().course;
  });

  /* ===== QUIZ QUERY ===== */

  const quizQuery = query(
    collection(db, "quizzes"),
    where("courseId", "in", courseIds.slice(0, 10)),
    orderBy("createdAt", "desc")
  );

  onSnapshot(quizQuery, (snapshot) => {

    panel.innerHTML = "";

    let total = snapshot.size;

    if (snapshot.empty) {
      panel.innerHTML = "<p>No notifications</p>";
    }

    snapshot.forEach(docSnap => {

      const data = docSnap.data();

      const div = document.createElement("div");
      div.className = "notificationItem";

      const courseName = courseMap[data.courseId] || "Course";
      const quizTitle = data.title || "Quiz";

      div.innerHTML = `
        <p>📝 ${courseName} – ${quizTitle}</p>
        <small>${formatTime(data.createdAt)}</small>
      `;

      div.onclick = () => {

        const token = localStorage.getItem("token");

        if (!token) {
          window.location.href = "login.html";
          return;
        }

        window.location.href = `dashboard.html?token=${token}`;
      };

      panel.appendChild(div);

    });

    /* ✅ BADGE = TOTAL QUIZZES */
    if (badge) {
      badge.innerText = total;
      badge.style.display = total > 0 ? "inline-block" : "none";
    }

  });

});


/* ================= TIME FORMAT ================= */

function formatTime(timestamp) {

  if (!timestamp) return "";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";

  return date.toLocaleDateString();

}