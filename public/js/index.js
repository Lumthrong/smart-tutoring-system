import { db, auth } from "./firebase.js";

import {
  collection,
  onSnapshot,
  addDoc,
  where,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===== GET STARTED SCROLL ===== */

const startBtn = document.getElementById("getStartedBtn");

if (startBtn) {

  startBtn.addEventListener("click", (e) => {

    e.preventDefault();

    document.getElementById("intro").scrollIntoView({
      behavior: "smooth"
    });

  });

}
//Hero-Slider//
const slides = document.querySelectorAll(".hero-slide");
let index = 0;

setInterval(() => {

  slides[index].classList.remove("active");

  index++;

  if (index >= slides.length) {
    index = 0;
  }

  slides[index].classList.add("active");

}, 7000);

