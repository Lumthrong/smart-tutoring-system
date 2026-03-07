import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {

  const bell = document.querySelector(".notify");
  const panel = document.getElementById("notificationPanel");

  /* ================= TOGGLE PANEL ================= */

  if (bell && panel) {

    bell.addEventListener("click", (e) => {

      e.stopPropagation();
      panel.classList.toggle("show");

    });

    /* Close when clicking outside */

    document.addEventListener("click", () => {
      panel.classList.remove("show");
    });

  }

});


/* ================= LOAD NOTIFICATIONS ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  console.log("Notification system started for:", user.uid);

  const badge = document.getElementById("notifyCount");
  const panel = document.getElementById("notificationPanel");

  /* ================= GET USER ROLE ================= */

  const userDoc = await getDoc(doc(db,"users",user.uid));

  if(!userDoc.exists()){
    console.warn("User document not found");
    return;
  }

  const role = userDoc.data().role;

  console.log("User role:",role);

  let q;

  try {

    /* ================= ROLE BASED QUERY ================= */

    q = query(
      collection(db, "notifications"),
      where("role","==",role),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

  } catch (err) {

    console.warn("OrderBy failed, fallback query used");

    q = query(
      collection(db, "notifications"),
      where("role","==",role),
      where("userId", "==", user.uid)
    );

  }

  onSnapshot(q, (snapshot) => {

    console.log("Notifications fetched:", snapshot.size);

    if (panel) panel.innerHTML = "";

    let unreadCount = 0;

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();

      if (!data.read) unreadCount++;

      if (panel) {

        const div = document.createElement("div");
        div.className = "notificationItem";

        div.innerHTML = `
        <p>${data.message}</p>
        <small>${formatTime(data.createdAt)}</small>
        `;

        if(!data.read){
          div.classList.add("unread");
        }

        /* ================= MARK AS READ ================= */

        div.addEventListener("click", async () => {

          if (!data.read) {

            await updateDoc(
              doc(db,"notifications",docSnap.id),
              {read:true}
            );

          }

          /* open related page if link exists */

          if(data.link){
            window.location.href = data.link;
          }

        });

        panel.appendChild(div);

      }

    });

    /* ================= BADGE COUNT ================= */

    if (badge) {

      badge.innerText = unreadCount;
      badge.style.display = unreadCount > 0 ? "inline-block" : "none";

    }

  }, (error) => {

    console.error("Notification listener error:", error);

  });

});


/* ================= TIME FORMAT ================= */

function formatTime(timestamp) {

  if (!timestamp) return "";

  const date = timestamp.toDate();

  const now = new Date();

  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)
    return "Just now";

  if (diff < 3600)
    return Math.floor(diff / 60) + " min ago";

  if (diff < 86400)
    return Math.floor(diff / 3600) + " hr ago";

  return date.toLocaleDateString();

}