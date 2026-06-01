import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= SHOW MESSAGE ================= */

function showMessage(message, type = "info") {

  let box = document.getElementById("systemMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "systemMessage";
    document.body.appendChild(box);
  }

  box.className = "systemMessage " + type;
  box.innerText = message;
  box.style.display = "block";

  setTimeout(() => {
    box.style.display = "none";
  }, 3000);

}
let activeCourseId = null;
let selectedMessage = null; 
let isEditing = false;
let quizTimer = null;
let aiQuizUsed = false;
let aiChartInstance = null;
let courseChartInstance = null;
let currentTranscript = "";


/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "login.html";
      return;
    }
    // ===== SET DASHBOARD USER NAME =====
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    const dashName = document.getElementById("dashboardUserName");
    const avatarLetter = document.getElementById("dashAvatarLetter");
    const profileImg = document.getElementById("dashProfileImg");

   /* ===== FETCH NAME FROM student_master ===== */
let studentName = null;

const studentSnap = await getDocs(
  query(
    collection(db, "student_master"),
    where("email", "==", user.email)
  )
);

if (!studentSnap.empty) {
  studentName = studentSnap.docs[0].data().name;
}

const name =
  studentName ||
  userData?.firstName ||
  user.displayName ||
  user.email ||
  "User";

if (dashName) {
  dashName.innerText = name;
}

    /* ===== 🔥 USE FIREBASE AUTH photoURL ===== */
    /* ===== FETCH IMAGE FROM FIRESTORE (CLOUDINARY) ===== */

    const photoURL = userData?.photoURL;

    console.log("Cloudinary URL:", photoURL); // DEBUG

    if (photoURL && profileImg) {

      profileImg.src = photoURL;

      profileImg.style.display = "block";

      if (avatarLetter) avatarLetter.style.display = "none";

    } else {

      if (profileImg) profileImg.style.display = "none";

      if (avatarLetter) {
        avatarLetter.style.display = "flex";
        avatarLetter.innerText = name.charAt(0).toUpperCase();
      }
    }
    document.getElementById("courseChartSelect").addEventListener("change", () => {
      loadCourseChart(auth.currentUser.uid);
    });

    document.getElementById("aiChartSelect").addEventListener("change", () => {
      loadAIChart(auth.currentUser.uid);
    });
    loadCourses(user.uid);
    loadDepartmentCourses(user.uid);
    loadLearningHistory(user.uid);
    loadStats(user.uid);
    loadAvailableQuizzes(user.uid);

    const quizBtn = document.getElementById("globalQuizBtn");
    const notesGlobalBtn = document.getElementById("globalNotesBtn");

    if (notesGlobalBtn) {
      notesGlobalBtn.onclick = () => {
        window.location.href = "notes.html";
      };
    }
    const panel = document.getElementById("quizListPanel");

    quizBtn.onclick = async () => {

      panel.classList.toggle("hidden");

      if (!panel.dataset.loaded) {
        await loadAvailableQuizzes(user.uid);
        panel.dataset.loaded = "true";
      }

    };

  });
});

/* ===== GLOBAL VTT FUNCTION ===== */
function generateVTT(segments) {
  let vtt = "WEBVTT\n\n";

  function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String((sec % 60).toFixed(3)).padStart(6, "0");
    return `${h}:${m}:${s}`;
  }

  segments.forEach((seg, i) => {
    const start = formatTime(seg.start);
    const end = formatTime(seg.end || seg.start + 3);

    vtt += `${i + 1}\n`;
    vtt += `${start} --> ${end}\n`;
    vtt += `${seg.text}\n\n`;
  });

  return vtt;
}
/* ================= LOAD COURSES ================= */
async function loadCourses(uid) {

  const userDoc = await getDoc(
    doc(db, "users", uid)
  );

  if (!userDoc.exists()) return;

  const userData = userDoc.data();

  const department = userData.department;
  const semester = userData.semester;

  const enrolledDiv = document.getElementById("enrolledCourses");
  const courseSelect = document.getElementById("courseSelect");
  const courseChartSelect = document.getElementById("courseChartSelect");
  const aiChartSelect = document.getElementById("aiChartSelect");
  const unitSelect = document.getElementById("unitSelect");

courseSelect.addEventListener("change", async () => {

  const selectedCourseId = courseSelect.value;

  unitSelect.innerHTML = "";

  if (!selectedCourseId) return;

  const unitsSnap = await getDocs(
    collection(db, "courses", selectedCourseId, "units")
  );

unitsSnap.forEach(doc => {

  const unit = doc.data();

  if (!unit.pdfURL) return; // 🚨 skip broken units

  const opt = document.createElement("option");
  opt.value = unit.pdfURL;
  opt.textContent = unit.title || "Unit";

  unitSelect.appendChild(opt);
});

});

const snapshot = await getDocs(
  query(
    collection(db, "subjects"),
    where("semester", "==", semester)
  )
);

enrolledDiv.innerHTML = "";
courseSelect.innerHTML = "";
courseChartSelect.innerHTML = "";
aiChartSelect.innerHTML = "";

document.getElementById("courseCount").innerText = snapshot.size;

for (const subjectDoc of snapshot.docs) {

  const subject = subjectDoc.data();

  const subjectName = subject.subjectName;

  let courseId = null;
  let data = null;

  const courseSnap = await getDocs(
    query(
      collection(db, "courses"),
      where("course", "==", subjectName)
    )
  );

  if (!courseSnap.empty) {
    courseId = courseSnap.docs[0].id;
    data = courseSnap.docs[0].data();
  }

      /* ===== dropdown select ===== */

      const option1 = document.createElement("option");
      option1.value = courseId;
      option1.textContent =
  data?.course || subjectName;

      const option2 = option1.cloneNode(true);
      const option3 = option1.cloneNode(true);

      courseSelect.appendChild(option1);

if (courseId) {
  courseChartSelect.appendChild(option2);
  aiChartSelect.appendChild(option3);
}

      /* ===== check quiz ===== */

      const quizQuery = query(
        collection(db, "quizzes"),
        where("courseId", "==", courseId)
      );

      const quizSnap = await getDocs(quizQuery);

      /* ===== course card ===== */

      const div = document.createElement("div");

div.innerHTML = `
      <p>
      <strong>${data?.course || subjectName}</strong>
      (Sem-${data?.semester || semester})
      </p>

      <div class="unitContainer"></div>

      ${data?.pdfURL ? `<a class="pdfLink coursePdfLink"><span class="material-symbols-outlined">
file_open
</span>Open</a>` : ""}

      <br><br>

<div class="videoWrapper hidden">

<div class="videoBox">
<video controls>
    <source src="${data?.videoURL}">
  </video>
</div>

  <div class="videoTranscript hidden"></div>

</div>

<div class="videoActionRow">

  <button class="discussionBtn">
    <span class="material-symbols-outlined">chat_bubble</span>
    Discussion
  </button>

  <button class="summaryBtn">
    <span class="material-symbols-outlined">neurology</span>
    Summary
  </button>
</div>


      <hr>
      `;
      /* ===== LOAD UNITS ===== */
      const unitContainer = div.querySelector(".unitContainer");
if (!courseId) {
  continue;
}

      const unitsSnap = await getDocs(
        collection(db, "courses", courseId, "units")
      );

      const units = unitsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      units.forEach((unit, index) => {

        const unitDiv = document.createElement("div");
        unitDiv.className = "unit-card";

        unitDiv.innerHTML = `
  <p><b>Unit ${index + 1}: ${unit.title}</b></p>

${unit.pdfURL && unit.pdfURL !== "undefined" ? `
<a class="pdfLink">
  <span class="material-symbols-outlined">file_open</span>
  Open
</a>
` : ""}

  ${unit.videoURL ? `
  <button class="playVideoBtn"><span class="material-symbols-outlined">
movie
</span></button>

  <div class="videoWrapper hidden">
    <video controls>
      <source src="${unit.videoURL}">
    </video>
  </div>

  <button class="transcriptBtn"><span class="material-symbols-outlined">subtitles</span>Transcript</button>
  <button class="openNotesBtn"><span class="material-symbols-outlined">note</span>Create Notes</button>
  ` : ""}

  <hr>
  `;

        /* ===== VIDEO ===== */
        const playBtn = unitDiv.querySelector(".playVideoBtn");
        const videoWrapper = unitDiv.querySelector(".videoWrapper");
        const video = unitDiv.querySelector("video");

        if (playBtn) {
          playBtn.onclick = () => {
            videoWrapper.classList.remove("hidden");
            video.play();
            playBtn.style.display = "none";
          };
        }

        /* ===== PDF ===== */
const pdfLink = unitDiv.querySelector(".pdfLink");

if (pdfLink) {

  if (!unit.pdfURL || unit.pdfURL === "undefined") {
    console.error("Missing PDF URL");
    pdfLink.style.display = "none";
    return;
  }

  pdfLink.href =
    "/viewer.html?file=" +
    encodeURIComponent(unit.pdfURL);

  pdfLink.addEventListener("click", async () => {

    try {

      await addDoc(
        collection(db, "learning_history"),
        {
          userId: auth.currentUser.uid,
          courseId,
          courseName: data?.course || subjectName,
          unitId: unit.id,
          unitTitle: unit.title,
          pdfURL: unit.pdfURL,
          openedAt: new Date()
        }
      );

    } catch (err) {

      console.error(
        "Learning history save failed",
        err
      );

    }

  });

}

        /* ===== NOTES ===== */
        const notesBtn = unitDiv.querySelector(".openNotesBtn");

        if (notesBtn) {
          notesBtn.onclick = () => {
            window.location.href =
              `notes.html?courseId=${courseId}&unitId=${unit.id}`;
          };
        }

        unitContainer.appendChild(unitDiv);
      });
      const video = div.querySelector("video");

      const playBtn = div.querySelector(".playVideoBtn");
      const videoWrapper = div.querySelector(".videoWrapper");

      if (playBtn) {
        playBtn.onclick = () => {
          videoWrapper.classList.remove("hidden");
          video.setAttribute("controls", true);
          video.play();
          playBtn.style.display = "none";
        };
      }
      const notesBtn = div.querySelector(".openNotesBtn");

      if (notesBtn) {
        notesBtn.onclick = async () => {

          const notesRef = doc(
            db,
            "notes",
            courseId + "_" + auth.currentUser.uid
          );

          const notesSnap = await getDoc(notesRef);

          /* ✅ IF NOTES EXIST → ONLY MESSAGE */
          if (notesSnap.exists()) {
            showMessage("Notes already exist");
            return;
          }

          try {
            if (!currentTranscript) {
  showMessage("Generate transcript first");
  return;
}
            const token = await auth.currentUser.getIdToken();

            const res = await fetch("/generate-notes", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
              },
              body: JSON.stringify({
               transcript: currentTranscript,
                courseId
              })
            });

           const data = await res.json();

if (!res.ok) {
  console.error("NOTES ERROR:", data);
  showMessage(data.error || "Notes generation failed");
  return;
}

if (!data.notes) {
  console.error("NO NOTES RETURNED:", data);
  showMessage("Notes generation failed");
  return;
}

            await setDoc(notesRef, {
              userId: auth.currentUser.uid,
              courseId,
              text: data.notes,
              createdAt: new Date()
            });

            showMessage("Notes generated");

          } catch (err) {

            console.error(err);
            showMessage("Failed to generate notes");

          }

        };
      }
      /* ===== TRACK PDF OPEN ===== */

const coursePdfLink = div.querySelector(".coursePdfLink");

if (coursePdfLink && data.pdfURL) {

  coursePdfLink.href = "/viewer.html?file=" + encodeURIComponent(data.pdfURL);
  coursePdfLink.target = "_self";

  coursePdfLink.addEventListener("click", async () => {

    try {
      await addDoc(collection(db, "learning_activity"), {
        userId: auth.currentUser.uid,
        courseId: courseId,
        department: data.department,
        openedAt: new Date()
      });
    } catch (err) {
      console.error("Activity tracking failed:", err);
    }

  });

}

      /* ===== discussion button ===== */

      const discussionBtn = div.querySelector(".discussionBtn");

      if (discussionBtn) {

        discussionBtn.onclick = () => {

          activeCourseId = courseId;

          loadComments(courseId);

          let chatBox = document.getElementById("chatBox");

          chatBox.classList.remove("hidden");

          /* MOVE CHAT BELOW THIS COURSE */
          div.appendChild(chatBox);

          /* SCROLL TO CHAT */
          chatBox.scrollIntoView({ behavior: "smooth", block: "start" });

        };

      }
      /* ===== AI SUMMARY BUTTON ===== */

      const summaryBtn = div.querySelector(".summaryBtn");

      if (summaryBtn) {

        summaryBtn.onclick = async () => {

          const originalText = summaryBtn.innerHTML;

          /* ===== SHOW LOADING ===== */

          summaryBtn.disabled = true;
          summaryBtn.innerHTML = `<span class="summarySpinner"></span> Generating...`;

          try {

            const res = await fetch("/summarize-course", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pdfURL: units[0]?.pdfURL || ""
              })
            });

            const result = await res.json();

            let summaryBox = div.querySelector(".aiSummary");

            if (!summaryBox) {
              summaryBox = document.createElement("div");
              summaryBox.className = "aiSummary";
              div.appendChild(summaryBox);
            }
            const raw = result.summary || "Summary failed";

            const lines = raw.split("\n");

            let html = "";
            let listOpen = false;

            lines.forEach(line => {

              line = line.trim();

              if (line.startsWith("**") && line.endsWith("**")) {
                if (listOpen) {
                  html += "</ul>";
                  listOpen = false;
                }

                const title = line.replace(/\*\*/g, "");
                html += `<h4>${title}</h4>`;
              }

              else if (line.startsWith("*") || line.startsWith("-")) {
                if (!listOpen) {
                  html += "<ul>";
                  listOpen = true;
                }

                html += `<li>${line.replace(/^[-*]/, "").trim()}</li>`;
              }

              else {
                if (listOpen) {
                  html += "</ul>";
                  listOpen = false;
                }

                html += `<p>${line}</p>`;
              }

            });

            if (listOpen) {
              html += "</ul>";
            }

            summaryBox.innerHTML = `
<div class="aiSummaryHeader">
<span> AI Summary</span>
<button class="closeSummary">✖</button>
</div>

<div class="aiSummaryContent"></div>
`;
            const closeBtn = summaryBox.querySelector(".closeSummary");

            closeBtn.onclick = () => {
              summaryBox.remove();
            };

            const content = summaryBox.querySelector(".aiSummaryContent");

            typeSummary(lines, content);
            summaryBtn.disabled = false;
            summaryBtn.innerHTML = originalText;
          } catch (err) {

            console.error(err);
            alert("AI summary failed");

            summaryBtn.disabled = false;
            summaryBtn.innerHTML = originalText;

          }

        };

      }
      /* ===== VIDEO TRANSCRIPT BUTTON ===== */

      const transcriptBtn = div.querySelector(".transcriptBtn");

      if (transcriptBtn) {

        let transcriptRunning = false;
        let transcriptLoaded = false; // 🔥 ADD THIS
        transcriptBtn.onclick = null;
        transcriptBtn.onclick = async () => {
const lockRef = doc(
  db,
  "transcript_locks",
  courseId + "_" + auth.currentUser.uid
);

          const lockSnap = await getDoc(lockRef);

          if (lockSnap.exists()) {

            const lockData = lockSnap.data();

            // 🔥 allow retry after 5 min
            if (Date.now() - lockData.createdAt.toMillis() < 300000) {
              console.log("Still processing...");
              return;
            } else {
              console.warn("Removing stuck lock");
              await deleteDoc(lockRef);
            }
          }

          if (transcriptRunning || transcriptLoaded) return;
          transcriptRunning = true;

          const originalText = transcriptBtn.innerHTML;

          transcriptBtn.disabled = true;
          transcriptBtn.innerHTML = `<span class="summarySpinner"></span> Generating...`;

          try {
let mergedSegments;
let fullTranscript;
 {
              await setDoc(lockRef, {
                status: "processing",
                createdAt: new Date()
              });
              console.log("Generating new transcript");
              const videoURL = units.find(u => u.videoURL)?.videoURL;

              if (!videoURL) {
                alert("No video found for transcript");
                return;
              }
              const res = await fetch("/generate-transcript", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  videoURL: videoURL
                })
              });
              if (!res.ok) {
                const text = await res.text();
                console.error("Server error:", text);
                throw new Error("Transcript API failed");
              }
              const result = await res.json();
              const jobIds = result.jobIds;
              if (!jobIds || !Array.isArray(jobIds)) {
                throw new Error("Invalid transcript response");
              }
              async function waitForTranscript(jobId) {

                const start = Date.now();

                while (true) {

                  const res = await fetch(`/transcript-status/${jobId}`);
                  const data = await res.json();

                  console.log("STATUS:", jobId, data);

                  if (data.status === "completed" && data.segments) {
                    return data.segments;
                  }

                  if (data.status === "failed") {
                    throw new Error("Transcription failed");
                  }

                  // 🔥 timeout (fix silent failures)
                  if (Date.now() - start > 300000) {
                    throw new Error("Timeout for " + jobId);
                  }

                  await new Promise(r => setTimeout(r, 1000));
                }
              }

              function formatTime(sec) {
                const h = String(Math.floor(sec / 3600)).padStart(2, "0");
                const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
                const s = String((sec % 60).toFixed(3)).padStart(6, "0");

                return `${h}:${m}:${s}`;
              }

              const video = div.querySelector("video") || div.querySelector(".unit-card video");

              const allSegments = await Promise.all(
                jobIds.map(async (id) => {
                  try {
                    return await waitForTranscript(id);
                  } catch (err) {

                    console.warn("Retrying chunk:", id);

                    try {
                      return await waitForTranscript(id);
                    } catch (err2) {
                      console.error("Chunk failed:", id, err2);
                      return [];
                    }

                  }
                })
              );
              const CHUNK_DURATION = 30;

              mergedSegments = allSegments
                .filter(seg => seg && seg.length > 0)
                .map((segments, index) => {

                  const offset = index * CHUNK_DURATION;

                  return segments.map(seg => ({
                    ...seg,
                    start: seg.start + offset
                  }));

                })
                .flat();
              // 🔥 Convert segments → full transcript text
              fullTranscript = mergedSegments
                .map(s => s.text)
                .join(" ");

                currentTranscript = fullTranscript;
              if (!mergedSegments || !Array.isArray(mergedSegments)) {
                throw new Error("Invalid transcript data");
              }

              if (!mergedSegments || mergedSegments.length === 0 || !fullTranscript.trim()) {
                throw new Error("Transcript empty - not saving");
              }
              await setDoc(lockRef, {
                status: "done",
                createdAt: new Date()
              });
              await deleteDoc(lockRef); // 🔥 unlock after success
            } // ✅ CLOSE ELSE BLOCK
            transcriptLoaded = true;
            const vttText = generateVTT(mergedSegments);
            const blob = new Blob([vttText], { type: "text/vtt" });
            const url = URL.createObjectURL(blob);

            let track = video.querySelector("track");

            if (!track) {
              track = document.createElement("track");
              track.kind = "subtitles";
              track.label = "English";
              track.srclang = "en";
              video.appendChild(track);
            }

            track.src = url;
            track.default = true;
            track.mode = "showing";


            /* ===== UI ===== */

            let box = div.querySelector(".videoTranscript");

            box.classList.remove("hidden");

            box.innerHTML = `
<div class="aiSummaryHeader">
<span> Transcript</span>
<button class="closeSummary">✖</button>
</div>

<div class="aiSummaryContent"></div>
`;

            const content = box.querySelector(".aiSummaryContent");

            content.innerHTML = mergedSegments
              .map(s => `<p>${s.text}</p>`)
              .join("");

            const closeBtn = box.querySelector(".closeSummary");

            closeBtn.onclick = () => {
              box.classList.add("hidden");
              box.innerHTML = "";
            };

          } catch (err) {

            console.error(err);
            alert("Transcript failed");
            await deleteDoc(lockRef); // 🔥 unlock on failure

          }
          transcriptRunning = false;
          transcriptBtn.disabled = false;
          transcriptBtn.innerHTML = originalText;

        };

      }
      async function typeSummary(lines, container) {

        let list;
        let listOpen = false;

        for (const rawLine of lines) {

          const line = rawLine.trim();

          if (!line) continue;

          await new Promise(r => setTimeout(r, 250)); // typing delay

          /* ===== TITLE ===== */

          if (line.startsWith("**") && line.endsWith("**")) {

            if (listOpen) {
              list = null;
              listOpen = false;
            }

            const title = line.replace(/\*\*/g, "");

            const h = document.createElement("h4");
            h.textContent = title;

            container.appendChild(h);
          }

          /* ===== BULLETS ===== */

          else if (line.startsWith("*") || line.startsWith("-")) {

            if (!listOpen) {
              list = document.createElement("ul");
              container.appendChild(list);
              listOpen = true;
            }

            const li = document.createElement("li");
            li.textContent = line.replace(/^[-*]/, "").trim();

            list.appendChild(li);
          }

          /* ===== PARAGRAPH ===== */

          else {

            listOpen = false;

            const p = document.createElement("p");
            p.textContent = line;

            container.appendChild(p);
          }

        }

      }

let deptSection =
document.querySelector(
 `[data-dept="${department}"]`
);


      if (!deptSection) {

        const folder = document.createElement("div");
        folder.className = "dept-folder";

        const title = document.createElement("h4");
        title.className = "dept-title";
title.textContent = department;

        deptSection = document.createElement("div");
        deptSection.className = "dept-courses hidden";
deptSection.setAttribute(
  "data-dept",
  department
);

        title.onclick = () => {
          deptSection.classList.toggle("hidden");
        };

        folder.appendChild(title);
        folder.appendChild(deptSection);

        enrolledDiv.appendChild(folder);

      }
if (!units.length) continue;
      deptSection.appendChild(div);

    }
    // ✅ AUTO LOAD FIRST COURSE UNITS
if (courseSelect.options.length > 0) {

  courseSelect.selectedIndex = 0;

  const selectedCourseId = courseSelect.value;

  unitSelect.innerHTML = "";

  const unitsSnap = await getDocs(
    collection(db, "courses", selectedCourseId, "units")
  );

unitsSnap.forEach(doc => {

  const unit = doc.data();

  if (!unit.pdfURL) return; // 🚨 ADD THIS LINE

  const opt = document.createElement("option");
  opt.value = unit.pdfURL;
  opt.textContent = unit.title || "Unit";

  unitSelect.appendChild(opt);

});

}
    if (courseChartSelect.options.length > 0) {
      courseChartSelect.selectedIndex = 0;
      loadCourseChart(uid);
    }

    if (aiChartSelect.options.length > 0) {
      aiChartSelect.selectedIndex = 0;
      loadAIChart(uid);
    }
}
async function loadDepartmentCourses(uid) {

  const userDoc = await getDoc(
    doc(db, "users", uid)
  );

  if (!userDoc.exists()) return;

  const userData = userDoc.data();

const department = userData.department;
const semester = userData.semester;

console.log("USER DATA:", userData);
console.log("DEPARTMENT:", department);
console.log("SEMESTER:", semester);

  const container =
    document.getElementById("departmentCourses");

  if (!container) return;

container.innerHTML = `
  <h3>${department} - Semester ${semester}</h3>
`;

const teacherSnap = await getDocs(
  query(
    collection(db,"teacher_master"),
    where(
      "department",
      "==",
      department
    )
  )
);

const teacherEmails =
  teacherSnap.docs.map(
    d => d.data().email.toLowerCase()
  );

const subjectSnap =
  await getDocs(
    collection(db,"subjects")
  );

subjectSnap.forEach(docSnap => {

  const subject =
    docSnap.data();

  const teacherEmail =
    (subject.teacherEmail || "")
    .toLowerCase();

  if (
    teacherEmails.includes(
      teacherEmail
    ) &&
    String(subject.semester).trim() ===
    String(semester).trim()
  ) {

    const div =
      document.createElement("div");

    div.className =
      "course-card";

    div.innerHTML = `
      <h4>
        ${subject.subjectName}
      </h4>
    `;

    container.appendChild(div);

  }

});

}

/* ================= LEARNING HISTORY ================= */

async function loadLearningHistory(uid) {

  const historyDiv = document.getElementById("learningHistory");

const historyQuery = query(
  collection(db, "learning_history"),
  where("userId", "==", uid),
  orderBy("openedAt", "desc")
);

const snap = await getDocs(historyQuery);

  historyDiv.innerHTML = "";

for (const docSnap of snap.docs) {

  const item = docSnap.data();

  const div = document.createElement("div");

  div.innerHTML = `
    <strong>${item.courseName}</strong>

    <p>Unit: ${item.unitTitle}</p>

    <p>
      Opened:
      ${new Date(
        item.openedAt.seconds * 1000
      ).toLocaleString()}
    </p>

    <hr>
  `;

  historyDiv.appendChild(div);

}

}


/* ================= STATS ================= */

async function loadStats(uid) {

  const aiQuery = query(
    collection(db, "ai_quiz_results"),
    where("userId", "==", uid)
  );

  const aiSnap = await getDocs(aiQuery);
  document.getElementById("aiQuizCount").innerText = aiSnap.size;

  const courseQuery = query(
    collection(db, "course_quiz_results"),
    where("userId", "==", uid)
  );

  const courseSnap = await getDocs(courseQuery);
  document.getElementById("courseQuizCount").innerText = courseSnap.size;

}


async function loadCourseChart(uid) {

  const selectedCourseId = document.getElementById("courseChartSelect").value;
  if (!selectedCourseId) return;

  const canvas = document.getElementById("courseQuizChart");

  const snap = await getDocs(query(
    collection(db, "course_quiz_results"),
    where("userId", "==", uid),
    where("courseId", "==", selectedCourseId)
  ));

  const labels = [];
  const scores = [];

  snap.forEach(doc => {
    labels.push("Quiz " + (labels.length + 1));
    scores.push(doc.data().score);
  });

  if (courseChartInstance) courseChartInstance.destroy();

  courseChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Course Quiz Score",
        data: scores,
        backgroundColor: "#22c55e"
      }]
    }
  });
}
async function loadAIChart(uid) {

  const selectedCourseId = document.getElementById("aiChartSelect").value;
  if (!selectedCourseId) return;

  const canvas = document.getElementById("aiQuizChart");

  const snap = await getDocs(query(
    collection(db, "ai_quiz_results"),
    where("userId", "==", uid),
    where("courseId", "==", selectedCourseId)
  ));

  const labels = [];
  const scores = [];

  snap.forEach(doc => {
    labels.push("AI Quiz " + (labels.length + 1));
    scores.push(doc.data().score);
  });

  if (aiChartInstance) aiChartInstance.destroy();

  aiChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "AI Quiz Score",
        data: scores,
        backgroundColor: "#6366f1"
      }]
    }
  });
}

/* ================= COURSE QUIZ ================= */

async function startTeacherQuiz(quizId) {

  const quizDoc = await getDoc(
    doc(db, "quizzes", quizId)
  );

  if (!quizDoc.exists()) {
    showMessage("Quiz not found");
    return;
  }

  const quizData = quizDoc.data();

  const resultId =
    auth.currentUser.uid + "_" + quizId;

  const resultDoc = await getDoc(
    doc(db, "course_quiz_results", resultId)
  );

  if (resultDoc.exists()) {
    showMessage("You already attempted this quiz");
    return;
  }

  const questionSnap = await getDocs(
    query(
      collection(db, "quiz_questions"),
      where("quizId", "==", quizId)
    )
  );
  console.log("QUIZ:", quizId);
console.log("QUESTION DOCS:", questionSnap.size);

questionSnap.forEach(doc => {
  console.log("QUESTION:", doc.data());
});

  const questions =
    questionSnap.docs.map(d => d.data());

  renderQuiz(
    questions,
    quizId,
    {
      ...quizData,
      courseId: quizData.courseId
    }
  );
}


/* ================= AI QUIZ ================= */

window.startTest = async function () {
// REMOVE PREVIOUS AI QUIZ
document.querySelectorAll(".aiQuizCard").forEach(el => el.remove());
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  const dashboard = document.querySelector(".dashboard");

  const loading = document.createElement("div");
  loading.className = "card";

  loading.innerHTML = `
<h3>Generating AI Quiz...</h3>
<div class="spinner"></div>
`;

  dashboard.prepend(loading);

  try {

    const courseSelect = document.getElementById("courseSelect");

    if (!courseSelect.value) {
      showMessage("Select a course first");
      loading.remove();
      return;
    }

    const unitSelect = document.getElementById("unitSelect");

    if (!unitSelect.value) {
      showMessage("Select a unit first");
      loading.remove();
      return;
    }

    const selectedPdf = unitSelect.value;
    const res = await fetch("/generate-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfURL: selectedPdf
      })
    });

    const data = await res.json();

    if (!res.ok || !data.questions || !Array.isArray(data.questions)) {
      console.error("AI ERROR:", data);
      showMessage(data.error || "AI quiz generation failed");
      return;
    }
    /* ================= STORE AI QUIZ ================= */
const courseId = document.getElementById("courseSelect").value;
    const aiQuizRef = await addDoc(collection(db, "ai_generated_quizzes"), {
      userId: auth.currentUser.uid,
      courseId,
      createdAt: new Date()
    });

    const quizId = aiQuizRef.id;

    for (const q of data.questions) {

      await addDoc(collection(db, "ai_quiz_questions"), {
        quizId,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation
      });

    }

    loading.remove();

    if (!data.questions || !Array.isArray(data.questions)) {
      showMessage("AI quiz generation failed");
      return;
    }

    /* create unique attempt id */
    const attemptId = auth.currentUser.uid + "_ai_" + Date.now();

    renderQuiz(data.questions, quizId, {
      title: "AI Quick Quiz",
      attemptId,
      ai: true,
      courseId
    });

  }
  catch (err) {

    console.error(err);

    loading.remove();
    showMessage("Quiz generation failed");

  }

};


/* ================= RENDER QUIZ ================= */

function renderQuiz(questions, quizId, quizData) {

  const attemptId = quizData.attemptId || null;

  const dashboard = document.querySelector(".dashboard");

const container = document.createElement("div");

container.className = "card";

if (quizData.ai) {
  container.classList.add("aiQuizCard");
}

  container.innerHTML = `
<h3>${quizData.title}</h3>
${!quizData.ai && quizData.timeLimit ? `<div id="timer"></div>` : ""}
`;

  dashboard.prepend(container);

  if (!quizData.ai && quizData.timeLimit) {
    startTimer(quizData.timeLimit);
  }

  questions.forEach((q, i) => {

    const div = document.createElement("div");

    div.innerHTML = `<p><b>${i + 1}. ${q.question}</b></p>`;

    (q.options || []).forEach((opt, index) => {
      div.innerHTML += `
<label>
<input type="radio" name="q${i}" value="${index}">
${opt}
</label><br>
`;
    });

    div.innerHTML += `<div id="explain${i}" style="display:none;"></div>`;

    container.appendChild(div);

  });

  /* ================= QUIZ BUTTON CONTAINER ================= */

  const buttonBox = document.createElement("div");
  buttonBox.className = "quiz-action-buttons";
  const submit = document.createElement("button");

  submit.className = "quiz-submit-btn";
  submit.innerText = "Submit Quiz";

  submit.onclick = async () => {

    clearInterval(quizTimer);

    let score = 0;

    questions.forEach((q, i) => {

      const selected = document.querySelector(`input[name="q${i}"]:checked`);

      let correctIndex = -1;

      const letterMap = ["a", "b", "c", "d"];

      if (letterMap.includes(String(q.answer).toLowerCase().trim())) {
        correctIndex = letterMap.indexOf(String(q.answer).toLowerCase().trim());
      }
      else {
        correctIndex = q.options.findIndex(
          opt => opt.trim().toLowerCase() === String(q.answer).trim().toLowerCase()
        );
      }

      const options = document.querySelectorAll(`input[name="q${i}"]`);

      options.forEach(opt => {

        const label = opt.parentElement;

        if (Number(opt.value) === correctIndex) {
          label.style.background = "#dcfce7";   // green
          label.style.border = "2px solid #22c55e";
        }

        if (opt.checked && Number(opt.value) !== correctIndex) {
          label.style.background = "#fee2e2";   // red
          label.style.border = "2px solid #ef4444";
        }

      });

      if (selected && Number(selected.value) === correctIndex) {
        score++;
      }

      /* show explanation */
      if (quizData.ai) {

        const explain = document.getElementById(`explain${i}`);

        explain.style.display = "block";

        explain.innerHTML = `
<p><b>Correct Answer:</b> ${q.answer}</p>
<p><b>Explanation:</b> ${q.explanation || "No explanation available."}</p>
`;

      }

    });

    const percent = (score / questions.length) * 100;

    if (!quizData.ai) {

      const resultId = auth.currentUser.uid + "_" + quizId;

      await setDoc(doc(db, "course_quiz_results", resultId), {
        userId: auth.currentUser.uid,
        courseId: quizData.courseId,
        quizId,
        score: percent,
        submittedAt: new Date()
      });

      showMessage("Quiz submitted successfully.");

      container.remove();
      loadStats(auth.currentUser.uid);
      loadCourseChart(auth.currentUser.uid);
      loadAIChart(auth.currentUser.uid);
    } else {

      /* save AI quiz result */

      const resultId = attemptId;

      const resultDoc = await getDoc(doc(db, "ai_quiz_results", resultId));

      if (resultDoc.exists()) {
        showMessage("You already submitted this quiz.");
        return;
      }

      await setDoc(doc(db, "ai_quiz_results", resultId), {
        userId: auth.currentUser.uid,
        courseId: quizData.courseId,
        quizId,
        score: percent,
        submittedAt: new Date()
      });

      aiQuizUsed = true;

      showMessage("AI Quiz submitted! Score: " + percent + "%");
      loadStats(auth.currentUser.uid);
    }

  };
  /* ================= REGENERATE BUTTON ================= */

  if (quizData.ai) {

    const regen = document.createElement("button");
    regen.className = "quiz-regenerate-btn";

    regen.innerText = "Regenerate Quiz";

    regen.style.marginLeft = "10px";

    regen.onclick = () => {

      container.remove();

      startTest(); // generate new AI quiz

    };

    buttonBox.appendChild(regen);

  }
  buttonBox.appendChild(submit);
  container.appendChild(buttonBox);

}


/* ================= TIMER ================= */

function startTimer(minutes) {

  let time = minutes * 60;

  const timer = document.getElementById("timer");

  quizTimer = setInterval(() => {

    time--;

    const m = Math.floor(time / 60);
    const s = time % 60;

    timer.innerText = `Time: ${m}:${s}`;

    if (time <= 0) {

      clearInterval(quizTimer);

      showMessage("Time up!");

    }

  }, 1000);

}

async function loadAvailableQuizzes(uid) {
  const userDoc = await getDoc(
  doc(db, "users", uid)
);

if (!userDoc.exists()) return;

const userData = userDoc.data();

const courseSnap = await getDocs(
  collection(db, "courses")
);

const allowedCourses = {};

courseSnap.forEach(docSnap => {

  const course = docSnap.data();

  if (
    String(course.department || "")
      .trim()
      .toLowerCase() ===
    String(userData.department || "")
      .trim()
      .toLowerCase()
    &&
    String(course.semester || "")
      .trim() ===
    String(userData.semester || "")
      .trim()
  ) {
    allowedCourses[docSnap.id] = course;
  }

});

console.log("ALLOWED COURSES:", allowedCourses);

console.log(
  "ALL COURSES:",
  courseSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }))
);

courseSnap.forEach(doc => {
  allowedCourses[doc.id] = doc.data();
});

  const panel = document.getElementById("quizListPanel");
  const countEl = document.getElementById("quizAvailableCount");

  /* 🔹 LISTEN TO QUIZZES (MAIN REAL-TIME) */
  onSnapshot(collection(db, "quizzes"), async (quizSnap) => {
    console.log("TOTAL QUIZZES:", quizSnap.size);

    let total = 0;
    const structure = {};

    for (const q of quizSnap.docs) {

      const quiz = q.data();
      const quizId = q.id;
      const courseId = quiz.courseId;
      console.log("QUIZ DATA:", quiz);
console.log("QUIZ ID:", quizId);
console.log("QUIZ COURSE ID:", courseId);
console.log("ALLOWED COURSES:", Object.keys(allowedCourses));
      const questionSnap = await getDocs(
  query(
    collection(db, "quiz_questions"),
    where("quizId", "==", quizId)
  )
  
);

const questionCount = questionSnap.size;
console.log("QUESTION COUNT:", questionCount);
if (questionCount === 0) {
  continue;
}
      
// build allowed courses once
const courseQuery = await getDocs(
  query(
    collection(db, "courses"),
    where("course", "==", courseId)
  )
);

if (courseQuery.empty) {
  console.log("Course not found:", courseId);
  continue;
}

const course = courseQuery.docs[0].data();

const subjectSnap = await getDocs(
  query(
    collection(db, "subjects"),
    where("subjectName", "==", courseId),
    where("semester", "==", userData.semester)
  )
);

if (subjectSnap.empty) {
  console.log("Subject not assigned:", courseId);
  continue;
}

      /* ✅ prevent reattempt */
      const resultId = uid + "_" + quizId;
      const resultDoc = await getDoc(doc(db, "course_quiz_results", resultId));

      if (resultDoc.exists()) continue;

      total++;

      if (!structure[course.department]) {
        structure[course.department] = {};
      }

      if (!structure[course.department][course.course]) {
        structure[course.department][course.course] = [];
      }

    structure[course.department][course.course].push({
  quizId,
  title: quiz.title,
  courseId,
  duration: quiz.timeLimit || 0,
  createdBy: quiz.createdBy || "Teacher",
  questionCount
});

    }

    /* 🔥 UPDATE UI (ALWAYS FRESH) */
    countEl.innerText = total;
    panel.innerHTML = "";

    for (const dept in structure) {

      const deptDiv = document.createElement("div");
      deptDiv.className = "quiz-dept";

      const deptTitle = document.createElement("h4");
      deptTitle.innerText = "📁 " + dept;

      deptDiv.appendChild(deptTitle);

      for (const course in structure[dept]) {

        const courseWrapper = document.createElement("div");
        courseWrapper.className = "quiz-course";

        const courseTitle = document.createElement("div");
        courseTitle.className = "quiz-course-title";
        courseTitle.innerText = course;

        const quizRow = document.createElement("div");
        quizRow.className = "quiz-row";

        structure[dept][course].forEach(q => {

          const btn = document.createElement("button");
          btn.className = "quiz-btn";
          btn.innerHTML = `
${q.title}<br>
<small>
${q.questionCount} Questions |
${q.duration} Min
</small>
`;

          btn.onclick = () => {
   startTeacherQuiz(q.quizId);
};

          quizRow.appendChild(btn);
        });

        courseWrapper.appendChild(courseTitle);
        courseWrapper.appendChild(quizRow);

        deptDiv.appendChild(courseWrapper);
      }

      panel.appendChild(deptDiv);
    }

  });

}

/* ================= DISCUSSION ================= */
function showChatActions(data) {

  const actionBar = document.getElementById("chatActions");
  const editBtn = document.getElementById("chatEditBtn");
  const deleteBtn = document.getElementById("chatDeleteBtn");

  actionBar.classList.remove("hidden");

  const isOwner = data.userId === auth.currentUser.uid;

  // ✅ show/hide edit
  editBtn.style.display = isOwner ? "inline-block" : "none";

}
async function loadComments(courseId) {

  const q = query(
    collection(db, "course_comments"),
    where("courseId", "==", courseId),
    orderBy("createdAt", "asc")
  );

  const list = document.querySelector(".commentList");

  onSnapshot(q, (snap) => {

    list.innerHTML = "";

snap.forEach(docSnap => {

  const data = docSnap.data();

  const div = document.createElement("div");

  const isOwner = data.userId === auth.currentUser.uid;

  // ✅ FIX ALIGNMENT (RIGHT = ME, LEFT = OTHERS)
  div.className = "chatMsg " + (isOwner ? "me" : "other");

  div.innerHTML = `
  <div class="msgContent">

    <div class="msgText">
      ${data.message}
      ${data.edited ? '<span class="edited">(edited)</span>' : ''}
    </div>

    <div class="msgMeta">

      <span class="msgTime">
        ${data.createdAt?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
      </span>

    </div>

  </div>
  `;
let pressTimer;

// ===== DESKTOP =====
div.addEventListener("mousedown", startPress);
div.addEventListener("mouseup", cancelPress);
div.addEventListener("mouseleave", cancelPress);

// ===== MOBILE =====
div.addEventListener("touchstart", startPress);
div.addEventListener("touchend", cancelPress);
div.addEventListener("touchcancel", cancelPress);

// ===== FUNCTIONS =====
function startPress(e) {

  pressTimer = setTimeout(() => {

    selectedMessage = {
      id: docSnap.id,
      data: data
    };

    document.querySelectorAll(".chatMsg").forEach(m => m.classList.remove("selected"));
    div.classList.add("selected");

    showChatActions(data);

  }, 500);

}

function cancelPress() {
  clearTimeout(pressTimer);
}
// cancel if released early
div.addEventListener("mouseup", () => clearTimeout(pressTimer));
div.addEventListener("mouseleave", () => clearTimeout(pressTimer));

  list.appendChild(div);

});

    list.scrollTop = list.scrollHeight;

  });

}


/* ================= SEND COMMENT ================= */

document.querySelector(".sendComment").onclick = async (e) => {

  e.stopPropagation(); // ✅ ADD THIS (VERY IMPORTANT)

  const input = document.querySelector(".commentInput");

  if (!input.value.trim()) return;

  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
  const user = userDoc.data();

  // 🔥 EDIT MODE
if (isEditing && selectedMessage) {

  const msgId = selectedMessage.id; // ✅ STORE BEFORE ANYTHING BREAKS

  isEditing = false; // ✅ LOCK STATE FIRST

  await setDoc(doc(db, "course_comments", msgId), {
    message: input.value,
    edited: true
  }, { merge: true });

  input.value = "";

  clearSelection();

  return;
}

  // 🔥 NORMAL MESSAGE
  await addDoc(collection(db, "course_comments"), {

    courseId: activeCourseId,
    userId: auth.currentUser.uid,
    userName: user.firstName || user.email,
    message: input.value,
    createdAt: new Date()

  });

  input.value = "";

};

const editBtn = document.getElementById("chatEditBtn");
const deleteBtn = document.getElementById("chatDeleteBtn");

if (deleteBtn) {

  deleteBtn.onclick = async () => {

    if (!selectedMessage) return;

    await deleteDoc(doc(db, "course_comments", selectedMessage.id));

    clearSelection();

  };

}

if (editBtn) {

  editBtn.onclick = () => {

    if (!selectedMessage) return;

    const input = document.querySelector(".commentInput");

    input.value = selectedMessage.data.message;
    input.focus();

    isEditing = true;

  };

}
function clearSelection() {

  selectedMessage = null;

  document.querySelectorAll(".chatMsg").forEach(m => m.classList.remove("selected"));

  const actionBar = document.getElementById("chatActions");
  actionBar.classList.add("hidden");

}
document.addEventListener("click", (e) => {

  const chatBox = document.getElementById("chatBox");

if (
!e.target.closest(".chatMsg") &&
!e.target.closest(".commentInput") &&
!e.target.closest(".sendComment") &&
!e.target.closest("#chatActions")
) {
  
  // ✅ CANCEL EDIT IF CLICK OUTSIDE
  if (isEditing) {
    isEditing = false;

    const input = document.querySelector(".commentInput");
    input.value = "";
  }

  clearSelection();
}

});
/* ================= CHAT CLOSE ================= */

const chatBox = document.getElementById("chatBox");
const closeBtn = document.getElementById("chatClose");

if (chatBox && closeBtn) {

  closeBtn.onclick = () => {
    chatBox.classList.add("hidden");
  };

}
