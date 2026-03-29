import { db, auth } from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("courseId");

let docId;

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  docId = courseId + "_" + user.uid;

  const notesRef = doc(db, "notes", docId);
  const snap = await getDoc(notesRef);

  if (snap.exists()) {
    document.getElementById("notesEditor").value = snap.data().notes;
  }

});

document.getElementById("saveNotesBtn").onclick = async () => {

  const text = document.getElementById("notesEditor").value;

  await setDoc(doc(db, "notes", docId), {
    notes: text,
    updatedAt: new Date()
  }, { merge: true });

  alert("Saved!");
};