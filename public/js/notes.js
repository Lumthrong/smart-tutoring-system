import { db, auth } from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("courseId");

let docId;
let selectedDocId = null;

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  const notesList =
    document.getElementById("notesList");

  const snap = await getDocs(
    query(
      collection(db, "notes"),
      where("userId", "==", user.uid)
    )
  );

  notesList.innerHTML = "";

  snap.forEach(noteDoc => {

    const data = noteDoc.data();

    const btn =
      document.createElement("button");

    btn.textContent =
  `${data.courseName} - ${data.unitTitle}`;

    btn.onclick = () => {

      selectedDocId = noteDoc.id;

      document.getElementById(
  "selectedCourseTitle"
).innerText =
  `${data.courseName} - ${data.unitTitle}`;

      document.getElementById(
        "notesEditor"
      ).value =
        data.notes || data.text || "";

    };

    notesList.appendChild(btn);

  });

});

document.getElementById("saveNotesBtn").onclick = async () => {

  const text = document.getElementById("notesEditor").value;

await setDoc(
  doc(db, "notes", selectedDocId),
  {
    notes: text,
    updatedAt: new Date()
  }, { merge: true });

  alert("Saved!");
};