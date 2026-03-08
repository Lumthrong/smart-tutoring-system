import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc
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

onAuthStateChanged(auth, (user) => {

  if (!user) return;

  const badge = document.getElementById("notifyCount");
  const panel = document.getElementById("notificationPanel");

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {

    if (panel) panel.innerHTML = "";

    let unreadCount = 0;

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      if (!data.read) unreadCount++;

      if (!panel) return;

      const div = document.createElement("div");
      div.className = "notificationItem";

      div.innerHTML = `
        <p>${data.message || "Notification"}</p>
        <small>${formatTime(data.createdAt)}</small>
      `;

      if(!data.read){
        div.classList.add("unread");
      }

      div.addEventListener("click", async () => {

        if (!data.read) {

          await updateDoc(
            doc(db,"notifications",docSnap.id),
            {read:true}
          );

        }

        if(data.link){
          window.location.href = data.link;
        }

      });

      panel.appendChild(div);

    });

    /* UPDATE BADGE */

    if (badge) {

      badge.innerText = unreadCount;
      badge.style.display = unreadCount > 0 ? "inline-block" : "none";

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