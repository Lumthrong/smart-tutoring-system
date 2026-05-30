import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import { createRequire } from "module";
import { v2 as cloudinary } from "cloudinary";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import admin from "firebase-admin";
dotenv.config();
import { setGlobalDispatcher, Agent } from "undici";
import FormData from "form-data";
import axios from "axios";
import { exec } from "child_process";
import util from "util";
import csv from "csv-parser";
import { createWorker }
from "tesseract.js";

async function ocrImage(imagePath){

  const worker =
    await createWorker("eng");

  const {
    data:{ text }
  } = await worker.recognize(imagePath);

  await worker.terminate();

  return text;

}

const execAsync = util.promisify(exec);

setGlobalDispatcher(
  new Agent({
    connect: { timeout: 60000 } // 60 seconds
  })
);

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/* ADD THIS LINE */
const db = admin.firestore();

/* ================= VERIFY FIREBASE TOKEN ================= */

async function verifyToken(req, res, next) {

  let token = null;

  // token from header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split("Bearer ")[1];
  }

  // token from URL
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  try {

    const decoded = await admin.auth().verifyIdToken(token);

    console.log("USER ROLE:", decoded.role);

    req.user = decoded;
    const userDoc = await db.collection("users").doc(decoded.uid).get();

if (userDoc.exists) {
  req.user.role = userDoc.data().role;
}

    next();

  } catch (err) {

    return res.status(401).send("Invalid token");

  }

}
/* ================= ROLE CHECK ================= */

function requireRole(role) {

  return async (req, res, next) => {

    if (!req.user) {
      return res.status(403).send("Forbidden");
    }

    try {

      const uid = req.user.uid;

      const userDoc = await db
        .collection("users")
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(403).send("Forbidden");
      }

      const userRole = userDoc.data().role;

      console.log("FIRESTORE ROLE:", userRole);

      if (role === "teacher") {
        if (userRole !== "teacher" && userRole !== "pending_teacher") {
          return res.status(403).send("Forbidden");
        }
      }

      else if (userRole !== role) {
        return res.status(403).send("Forbidden");
      }

      next();

    } catch (err) {

      console.error("ROLE CHECK ERROR:", err);
      res.status(500).send("Server error");

    }

  };

}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);

const app = express();
let activeTranscriptions = 0;
const MAX_TRANSCRIPTIONS = 2;
app.use(cors());
app.use(express.json());

/* ================= PATH SETUP ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= DASHBOARD PROTECTION ================= */

app.get("/admin.html",
  verifyToken,
  requireRole("admin"),
  (req, res) => {
    res.sendFile(path.join(__dirname, "public/admin.html"));
  }
);

app.get("/teacher.html",
  verifyToken,
  requireRole("teacher"),
  (req, res) => {
    res.sendFile(path.join(__dirname, "public/teacher.html"));
  }
);

app.get("/dashboard.html",
  verifyToken,
  (req, res) => {
    res.sendFile(path.join(__dirname, "public/dashboard.html"));
  }
);
/* ================= STATIC FILES ================= */

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= ENSURE UPLOAD FOLDER ================= */

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ================= MULTER CONFIG ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

/* ================= EMAIL OTP SYSTEM ================= */

const otpStore = new Map();

/* ================= SEND OTP ================= */

app.post("/send-otp", async (req, res) => {

  const email = req.body.email.trim().toLowerCase();

  if (!email)
    return res.status(400).json({ error: "Email required" });

  const otp = String(Math.floor(100000 + Math.random() * 900000));

  otpStore.set(email, {
    otp,
    expires: Date.now() + 10 * 60 * 1000
  });

  try {

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          email: "iamrein22@gmail.com",
          name: "Smart Tutor"
        },
        to: [{ email: email }],
        subject: "Smart Tutor Verification Code",
        htmlContent: `
<div style="font-family:Segoe UI,Arial;background:#f4f6fb;padding:40px">

<div style="max-width:480px;margin:auto;background:white;border-radius:12px;
box-shadow:0 10px 25px rgba(0,0,0,0.08);overflow:hidden">

<div style="background:linear-gradient(135deg,#4f46e5,#6366f1);
padding:24px;text-align:center;color:white">

<h2 style="margin:0">Smart Tutor</h2>
<p style="margin:5px 0 0 0;font-size:14px">Account Verification</p>

</div>

<div style="padding:30px;text-align:center">

<p>Your verification code:</p>

<div style="
background:#f3f4ff;
border:2px dashed #4f46e5;
border-radius:10px;
padding:18px 30px;
display:inline-block;
margin:15px 0;
">

<span style="
font-size:34px;
font-weight:700;
letter-spacing:8px;
color:#4f46e5;
">
${otp}
</span>

</div>

<p>This code expires in <b>10 minutes</b>.</p>

</div>
</div>
</div>
`
      })
    });
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("BREVO ERROR:", errorText);
      return res.status(500).json({ error: "Email send failed" });
    }

    res.json({ success: true });

  } catch (err) {

    console.error("BREVO EMAIL ERROR:", err);
    res.status(500).json({ error: "Email send failed" });

  }

});

/* ================= VERIFY OTP ================= */

app.post("/verify-otp", (req, res) => {

  const email = String(req.body.email).trim().toLowerCase();
  const otp = String(req.body.otp).trim();

  const data = otpStore.get(email);

  if (!data) {
    return res.status(400).json({ error: "OTP expired" });
  }

  if (Date.now() > data.expires) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP expired" });
  }

  if (String(data.otp) !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  otpStore.delete(email);

  otpStore.set(email, {
    otp,
    expires: Date.now() + 10 * 60 * 1000
  });

  res.json({ success: true });

});


/* ================= TEACHER ACCESS REQUEST ================= */
app.post("/notify-teacher-request", async (req, res) => {

  const data = req.body;

  try {

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({

        sender: {
          email: process.env.EMAIL_USER,
          name: "Smart Tutor"
        },

        to: [{ email: process.env.ADMIN_EMAIL }],

        subject: "New Teacher Access Request",

        htmlContent: `
<h2>Teacher Request</h2>

<p><b>Name:</b> ${data.name}</p>
<p><b>Email:</b> ${data.email}</p>
<p><b>Qualification:</b> ${data.qualification}</p>
<p><b>Institution:</b> ${data.institution}</p>
<p><b>Experience:</b> ${data.experience}</p>

<p><b>Document:</b> ${data.document}</p>

<p><b>Message:</b></p>
<p>${data.message}</p>
`
      })

    });

    res.json({ success: true });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Email failed" });

  }

});
/* ================= SET USER ROLE CLAIM ================= */

app.post("/set-role", async (req, res) => {

  const { uid, role } = req.body;

  if (!uid || !role) {
    return res.status(400).json({ error: "uid and role required" });
  }

  try {

    await admin.auth().setCustomUserClaims(uid, { role });

    // verify claim was written
    const user = await admin.auth().getUser(uid);

    console.log("ROLE SET:", user.customClaims);

    res.json({ success: true });

  } catch (err) {

    console.error("SET ROLE ERROR:", err);
    res.status(500).json({ error: "Failed to set role" });

  }

});
/* ================= COURSE UPLOAD ================= */

const multiUpload = upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "video", maxCount: 1 }
]);

app.post(
  "/upload",
  verifyToken,
  requireRole("teacher"),
  multiUpload,
  async (req, res) => {

  try {

const { department, semester, course, unitTitle } = req.body;
const teacherEmail =
  req.user.email.toLowerCase();

const subjectSnap = await db
  .collection("subjects")
  .where("teacherEmail", "==", teacherEmail)
  .where("subjectName", "==", course)
  .get();

if (subjectSnap.empty) {

  return res.status(403).json({
    error: "Subject not assigned to teacher"
  });

}

    if (!req.files || !req.files.pdf)
      return res.status(400).json({ error: "PDF required" });

    const pdfFile = req.files.pdf[0];
    const videoFile = req.files.video ? req.files.video[0] : null;
    const coverFile = req.files.cover ? req.files.cover[0] : null;

    let coverUpload = null;

    if (coverFile) {

      coverUpload = await cloudinary.uploader.upload(coverFile.path, {
        folder: "uploads/covers"
      });

    }

    /* ================= EXTRACT PDF TEXT ================= */

    let extractedText = null;

    try {
      const pdfBuffer = fs.readFileSync(pdfFile.path);
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text.substring(0, 15000);
    } catch (err) {
      console.error("PDF PARSE ERROR:", err);
    }

    /* ================= CLOUDINARY PDF UPLOAD ================= */

    const pdfUpload = await cloudinary.uploader.upload(pdfFile.path, {
      resource_type: "raw",
      folder: "uploads/pdfs"
    });

    /* ================= CLOUDINARY VIDEO UPLOAD ================= */

    let videoUpload = null;

    if (videoFile) {

      videoUpload = await cloudinary.uploader.upload(videoFile.path, {
        resource_type: "auto",
        folder: "uploads/videos"
      });

    }

    /* ================= DELETE TEMP FILES ================= */

    fs.unlinkSync(pdfFile.path);
    if (videoFile) fs.unlinkSync(videoFile.path);
    if (coverFile) fs.unlinkSync(coverFile.path);

    // SAVE UNIT INTO FIRESTORE (NEW)

const courseRef = db.collection("courses").doc(course);

// ensure course exists
await courseRef.set({
  course,
  department,
  semester,
  teacherEmail,
  uploadedBy: req.user.uid
}, { merge: true });

// add unit
await courseRef.collection("units").add({
  title: unitTitle || "Untitled Unit",
  videoURL: videoUpload ? videoUpload.secure_url : null,
  pdfURL: pdfUpload.secure_url,
  teacherEmail,
  uploadedBy: req.user.uid,
  createdAt: new Date()
});

    res.json({
      success: true,
      department,
      semester,
      course,

      coverURL: coverUpload ? coverUpload.secure_url : null,
      coverFilename: coverUpload ? coverUpload.public_id : null,

      pdfURL: pdfUpload.secure_url,
      pdfFilename: pdfUpload.public_id,

      videoURL: videoUpload ? videoUpload.secure_url : null,
      videoFilename: videoUpload ? videoUpload.public_id : null,

      text: extractedText
    });

  }
  catch (err) {

    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });

  }

});

/* ================= SECURE PDF ================= */
app.get("/secure-pdf", verifyToken, async (req, res) => {

const url = req.query.file;

console.log("PDF REQUEST URL:", url); // 🔥 DEBUG

if (!url || url === "undefined") {
  return res.status(400).send("Invalid PDF URL");
}

  try {

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).send("Failed to fetch PDF");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "application/pdf");
    res.send(buffer);

  } catch (err) {

    console.error("PDF STREAM ERROR:", err);
    res.status(500).send("PDF stream failed");

  }

});
/* ================= DELETE FILE ================= */

app.delete("/delete-course/:publicId", async (req, res) => {

  try {

    const publicId = req.params.publicId;

    if (!publicId)
      return res.status(400).json({ error: "File id required" });

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "auto"
    });

    res.json({ success: true });

  }
  catch (err) {

    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });

  }

});

/* ================= PROFILE IMAGE UPLOAD ================= */

app.post("/upload-profile", upload.single("profile"), async (req, res) => {

  try {

    if (!req.file)
      return res.status(400).json({ success: false });

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "uploads/profiles"
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      fileURL: uploadResult.secure_url,
      filename: uploadResult.public_id
    });

  }
  catch (err) {

    console.error("PROFILE UPLOAD ERROR:", err);
    res.status(500).json({ success: false });

  }

});

/* ================= AI TEST GENERATION ================= */
async function askGroq(model, prompt) {

  try {

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    );

    const data = await res.json();

    /* HANDLE GROQ ERRORS */

    if (data.error) {
      console.error("GROQ ERROR:", data.error.message);
      return "incorrect";
    }

    /* HANDLE EMPTY RESPONSE */

    if (!data.choices || !data.choices[0]) {
      console.error("GROQ INVALID RESPONSE:", data);
      return "incorrect";
    }

    return data.choices[0].message.content;

  }
  catch (err) {

    console.error("GROQ REQUEST FAILED:", err);
    return "incorrect";

  }

}
async function verifyGemini(question, options, answer) {

  const prompt = `
Question:
${question}

Options:
${options.join("\n")}

Proposed Correct Answer:
${answer}

Return ONLY:
correct
or
incorrect
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    }
  );

  const data = await res.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return text.toLowerCase().includes("correct");

}

async function verifyWithThreeModels(question, options, answer) {

  const prompt = `
Question:
${question}

Options:
${options.join("\n")}

Proposed Correct Answer:
${answer}

Return ONLY:
correct
or
incorrect
`;

  try {

    const [groq1, groq2, gemini] = await Promise.all([

      askGroq("llama-3.3-70b-versatile", prompt),
      askGroq("llama-3.1-8b-instant", prompt),
      verifyGemini(question, options, answer)

    ]);

    const r1 = String(groq1).toLowerCase().includes("correct");
    const r2 = String(groq2).toLowerCase().includes("correct");
    const r3 = gemini;

    const votes = [r1, r2, r3].filter(v => v).length;

    return votes >= 2;

  } catch (err) {

    console.error("Verification error:", err);
    return false;

  }

}

/*regenerate math*/
async function repairMathText(text) {

  const prompt = `
The following text was extracted from a PDF and contains
broken mathematical symbols.

Fix the text and restore the correct math expressions.

Text:
${text}
`;

  const repaired = await askGroq("llama-3.3-70b-versatile", prompt);

  if (!repaired || repaired === "incorrect") {
    return text;
  }

  return repaired;

}
app.post("/generate-test", async (req, res) => {

  const { pdfURL } = req.body;

  if (!pdfURL)
    return res.status(400).json({ error: "PDF URL required" });

  try {

    /* ================= READ PDF FROM CLOUDINARY ================= */

    const responsePdf = await fetch(pdfURL);

    if (!responsePdf.ok) {
      console.error("Cloudinary fetch failed:", responsePdf.status);
      return res.status(500).json({ error: "Failed to fetch PDF from Cloudinary" });
    }

const pdfArrayBuffer = await responsePdf.arrayBuffer();
const pdfBuffer = Buffer.from(pdfArrayBuffer);

/* ================= PDF PARSE ================= */

const pdfData = await pdfParse(pdfBuffer);

let extractedText = pdfData.text || "";

const words = extractedText
  .replace(/\s+/g, " ")
  .trim()
  .split(" ")
  .filter(Boolean);

console.log("WORD COUNT:", words.length);

if (words.length < 50) {

  return res.status(400).json({
    error: "PDF text too small for quiz generation"
  });

}

    /* ================= RANDOM CHUNK (AVOIDS TOKEN LIMITS) ================= */

    const chunkSize = 1200;

    const start = Math.floor(
      Math.random() * Math.max(1, words.length - chunkSize)
    );

    let text = words.slice(start, start + chunkSize).join(" ");

    /* Repair corrupted math expressions */

    if (/[=√×÷^≤≥±]/.test(text)) {
      text = await repairMathText(text);
    }

    /* ================= AI REQUEST ================= */

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "user",
              content: `
You are an academic exam generator.

The syllabus text below was extracted from a PDF and may contain
missing or corrupted mathematical symbols.

Your task:
1. If mathematical expressions appear, reconstruct the intended symbols
   such as ≥ ≤ ≠ ± × ÷ √ ^ ² ³ −.
2. If no mathematical expressions are present, generate normal
   conceptual or factual questions from the syllabus.
3. priortize covering random portions of the entire syllabus. 
   example: General knowledge, reasoning, science, english if available in the syllabus.

Rules:
- Generate EXACTLY 5 MCQs from the syllabus.
- Questions can be conceptual, theoretical, numerical, or definition based.
- Do NOT invent information outside the syllabus.
- If math expressions appear, fix corrupted symbols before using them.
- Each question must have exactly 4 options.
- The correct answer MUST be exactly one of the options.

Return STRICT JSON ONLY.

{
 "questions":[
  {
   "question":"...",
   "options":["...","...","...","..."],
   "answer":"exact option text",
   "explanation":"short explanation"
  }
 ]
}

If the syllabus cannot generate questions, return:

{"questions":[]}

Syllabus:
${text}
`
            }
          ]
        })
      }
    );

    const data = await response.json();

    /* ================= VALIDATE AI RESPONSE ================= */

    if (!data.choices || !data.choices[0]) {
      console.error("AI RESPONSE ERROR:", data);
      return res.status(500).json({ error: "AI response invalid" });
    }

    const raw = data.choices[0].message.content;

    let parsed;

    try {

      let cleaned = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const match = cleaned.match(/\{[\s\S]*\}/);

      if (!match) {
        throw new Error("No JSON detected");
      }

      parsed = JSON.parse(match[0]);

    } catch (err) {

      console.warn("AI JSON fixed automatically");

      const match = raw.match(/\{[\s\S]*\}/);

      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return res.status(500).json({
          error: "AI returned invalid JSON"
        });
      }

    }

    /* ================= VERIFY QUESTIONS ================= */

    const verifiedQuestions = [];

    for (const q of parsed.questions) {

      await new Promise(r => setTimeout(r, 1200));
      /* FILTER BAD QUESTIONS */
if(
 !Array.isArray(q.options) ||
 q.options.length !== 4
){
 continue;
}
      if (!q.options.includes(q.answer)) {
        console.warn("Rejected question because answer not in options:", q.question);
        continue;
      }

      const verified = await verifyWithThreeModels(
        q.question,
        q.options,
        q.answer
      );

      if (verified) {
        verifiedQuestions.push(q);
      }

    }

    /* if AI removed too many questions */

    if (verifiedQuestions.length < 3) {
      console.warn("Too many questions rejected by verification");
    }

    res.json({
      questions: verifiedQuestions
    });

  } catch (err) {

    console.error("AI ERROR:", err);
    res.status(500).json({ error: "AI failed" });

  }

});
/* ================= AI COURSE SUMMARY ================= */

app.post("/summarize-course", async (req, res) => {

  const { pdfURL } = req.body;

  if (!pdfURL)
    return res.status(400).json({ error: "PDF required" });

  try {

    const response = await fetch(pdfURL);
    const buffer = Buffer.from(await response.arrayBuffer());

    const pdfData = await pdfParse(buffer);

    const text = pdfData.text.substring(0, 4000);

    const ai = await askGroq(
      "llama-3.1-8b-instant",
      `
Summarize this course in simple.
rule: 
1. skip cover pages.
2. summarize what this course is about.(a little insight)
3. do not explain the specific details. analyse the course carefully and summarise it.

Text:
${text}
`
    );

    res.json({ summary: ai });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "AI summary failed" });

  }

});
async function waitForWhisperReady() {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch("https://marcell-uncaused-nonproblematically.ngrok-free.dev/health");

      console.log("STATUS:", res.status);

      if (!res.ok) {
        throw new Error("Bad response");
      }

      const data = await res.json();
      console.log("HEALTH DATA:", data);

      if (data && data.model_loaded === true) {
        console.log("Whisper ready");
        return;
      }

    } catch (err) {
      console.log("Health check failed:", err.message);
    }

    console.log("Waiting for Whisper...");
    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error("Whisper not ready");
}
app.post("/generate-transcript", async (req, res) => {

  if (activeTranscriptions >= MAX_TRANSCRIPTIONS) {
  return res.status(429).json({
    error: "Server busy, try again later"
  });
}

activeTranscriptions++;

  const { videoURL } = req.body;

  if (!videoURL) {
    return res.status(400).json({ error: "Video URL missing" });
  }

  try {

    const tempVideo = path.join(__dirname, "temp_video.mp4");
    const tempAudio = path.join(__dirname, "temp_audio.mp3");

    /* ===== DOWNLOAD VIDEO ===== */
    const videoRes = await fetch(videoURL);
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    fs.writeFileSync(tempVideo, buffer);

    /* ===== CONVERT TO AUDIO ===== */
    await execAsync(
      `ffmpeg -i "${tempVideo}" -vn -acodec libmp3lame -ab 128k -ac 1 -ar 16000 "${tempAudio}"`
    );

    /* ===== SPLIT INTO CHUNKS ===== */
    const chunkPattern = path.join(__dirname, "chunk_%03d.mp3");

    await execAsync(
  `ffmpeg -i "${tempAudio}" \
  -af "silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-40dB,volume=2.0" \
  -ac 1 -ar 16000 \
  -f segment -segment_time 30 \
  "${chunkPattern}"`
);

    /* ===== GET CHUNKS ===== */
    const chunkFiles = fs.readdirSync(__dirname)
      .filter(f => f.startsWith("chunk_"))
      .sort();

    console.log("CHUNKS:", chunkFiles);
    await waitForWhisperReady();

    /* ===== CONTROLLED PARALLEL (NO CRASH) ===== */

    const CONCURRENT_LIMIT = 3; 

    const jobIds = [];

    for (let i = 0; i < chunkFiles.length; i += CONCURRENT_LIMIT) {

      const batch = chunkFiles.slice(i, i + CONCURRENT_LIMIT);

      const batchPromises = batch
  .map(file => {
    const filePath = path.join(__dirname, file);
    const stats = fs.statSync(filePath);

    if (stats.size < 5000) {
      console.log("Skipping weak chunk:", file);
      return null;
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath), {
      filename: file,
      contentType: "audio/mpeg"
    });

    return uploadWithRetry(formData);
  })
  .filter(Boolean);
        
        async function uploadWithRetry(formData) {

          for (let i = 0; i < 5; i++) {
            try {
              return await axios.post(
                "https://marcell-uncaused-nonproblematically.ngrok-free.dev/transcribe",
                formData,
                {
                  headers: {
                    ...formData.getHeaders()
                  },
                  maxBodyLength: Infinity,
                  maxContentLength: Infinity,
                  timeout: 300000
                }
              );
            } catch (err) {
              console.error("UPLOAD ERROR:", err.response?.data || err.message);
              console.warn("Retrying chunk...", i + 1);
              await new Promise(r => setTimeout(r, 2000));
            }
          }

          throw new Error("Chunk upload failed");
        }

      const results = await Promise.all(batchPromises);

      results.forEach(r => {
        if (r && r.data && r.data.jobId) {
          jobIds.push(r.data.jobId);
        } else {
          console.error("Invalid chunk response:", r);
        }
      });

    }
    console.log("JOB IDS:", jobIds);

    /* ===== CLEANUP SAFE ===== */
  try {

  if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
  if (fs.existsSync(tempAudio)) fs.unlinkSync(tempAudio);

  chunkFiles.forEach(f => {
    const filePath = path.join(__dirname, f);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  console.log("🧹 Cleanup after success done");

} catch (cleanupErr) {
  console.error("Cleanup failed:", cleanupErr);
}

   if (!jobIds.length) {

  console.error("All chunks failed — cleaning up");

  try {

    const tempVideo = path.join(__dirname, "temp_video.mp4");
    const tempAudio = path.join(__dirname, "temp_audio.mp3");

    if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    if (fs.existsSync(tempAudio)) fs.unlinkSync(tempAudio);

    const files = fs.readdirSync(__dirname);

    files.forEach(f => {
      if (f.startsWith("chunk_")) {
        const filePath = path.join(__dirname, f);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

  } catch (cleanupErr) {
    console.error("Cleanup failed:", cleanupErr);
  }

  return res.status(500).json({
    error: "All chunks failed"
  });
}

res.json({ jobIds });

activeTranscriptions = Math.max(0, activeTranscriptions - 1);

} catch (err) {

  activeTranscriptions = Math.max(0, activeTranscriptions - 1);

  console.error("TRANSCRIPT ERROR:", err);

  // 🔥 ===== FORCE CLEANUP (CRITICAL) =====
  try {

    const tempVideo = path.join(__dirname, "temp_video.mp4");
    const tempAudio = path.join(__dirname, "temp_audio.mp3");

    if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    if (fs.existsSync(tempAudio)) fs.unlinkSync(tempAudio);

    const files = fs.readdirSync(__dirname);

    files.forEach(f => {
      if (f.startsWith("chunk_")) {
        const filePath = path.join(__dirname, f);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    console.log("🧹 Cleanup after failure done");

  } catch (cleanupErr) {
    console.error("Cleanup failed:", cleanupErr);
  }
  // 🔥 ===== END CLEANUP =====

  res.status(500).json({ error: "Transcript failed" });

}

});
app.get("/transcript-status/:jobId", async (req, res) => {

  const { jobId } = req.params;

  try {

    const response = await fetch(
      `https://marcell-uncaused-nonproblematically.ngrok-free.dev/status/${jobId}`
    );

    const text = await response.text();

    /* ===== DEBUG RESPONSE ===== */
    if (!text || text.trim() === "") {
      console.warn("EMPTY RESPONSE FROM WHISPER");
      return res.json({ status: "processing" }); // 🔥 important
    }

    if (text.startsWith("<")) {
      console.error("HTML RESPONSE FROM WHISPER:", text);
      return res.json({ status: "processing" }); // 🔥 important
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("INVALID JSON FROM WHISPER:", text);
      return res.json({ status: "processing" }); // 🔥 important
    }

    res.json(data);

  } catch (err) {

    console.error("STATUS ERROR:", err);
    res.status(500).json({ error: "Status check failed" });

  }

});
app.post("/generate-notes", verifyToken, async (req, res) => {

const { transcript, courseId } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "Transcript required" });
  }

  try {

    const ai = await askGroq(
      "llama-3.1-8b-instant",
      `
Convert this transcript into structured study notes.

Rules:
- Use bullet points
- DO NOT use markdown symbols like ** or *
- Use clean plain text only
- Highlight key concepts using simple headings
- Keep it easy to revise

Transcript:
${transcript}
`
    );

    // 🔥 SAVE TO FIRESTORE
const docId = req.user.uid + "_" + req.body.courseId;

const docRef = await db.collection("notes").doc(docId).set({
  userId: req.user.uid,
  courseId: courseId, // ✅ ADD THIS
  transcript: transcript.substring(0, 5000),
  notes: ai,
  createdAt: new Date()
});

    res.json({
      notes: ai,
      id: docRef.id
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Notes generation failed" });

  }

});

/* ================= Admin Panel ================= */
app.post(
  "/admin/upload-teachers",
  verifyToken,
  requireRole("admin"),
  upload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: "CSV file required"
        });
      }

      if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
        return res.status(400).json({
          error: "Only CSV allowed"
        });
      }

      const teachers = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {

          if (
            !row.email &&
            !row.Email &&
            !row.EMAIL
          ) {
            return;
          }

          teachers.push(row);

        })
        .on("end", async () => {

          const batch = db.batch();

          // DELETE OLD TEACHERS
          const existingTeachers =
            await db.collection("teacher_master").get();

          existingTeachers.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });

          // DELETE OLD SUBJECTS
          const existingSubjects =
            await db.collection("subjects").get();

          existingSubjects.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });

          for (const teacher of teachers) {

            const email =
              teacher.email ||
              teacher.Email ||
              teacher.EMAIL;

            if (!email) continue;

            const teacherRef =
              db.collection("teacher_master")
                .doc(email.trim().toLowerCase());

            batch.set(teacherRef, {
              name:
                teacher.name ||
                teacher.Name ||
                "",

              email:
                email.trim().toLowerCase(),

              department:
                teacher.department ||
                teacher.Department ||
                "",

              semester:
                teacher.semester ||
                teacher.Semester ||
                "",

              subjects:
                teacher.subjects ||
                teacher.Subjects ||
                "",

              role: "teacher",

              updatedAt: new Date()
            });

            const subjects =
              (teacher.subjects ||
               teacher.Subjects ||
               "")
              .split("|")
              .filter(Boolean);

            subjects.forEach(subject => {

              const subjectId =
                `${teacher.department}_${subject.trim()}`
                  .replace(/[\/\\]/g, "_")
                  .replace(/\s+/g, "_")
                  .replace(/[^a-zA-Z0-9_]/g, "")
                  .toLowerCase();

              const subjectRef =
                db.collection("subjects")
                  .doc(subjectId);

              batch.set(subjectRef, {
                subjectName: subject.trim(),
                department: teacher.department,
                semester: teacher.semester,
                teacherEmail: email.trim().toLowerCase(),
                teacherName: teacher.name,
                updatedAt: new Date()
              });

            });

          }

          await batch.commit();

          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            count: teachers.length
          });

        });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Teacher upload failed"
      });

    }

});
app.post(
  "/admin/upload-students",
  verifyToken,
  requireRole("admin"),
  upload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: "CSV file required"
        });
      }

      const students = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {

          if (
            !row.email &&
            !row.Email &&
            !row.EMAIL
          ) {
            return;
          }

          students.push(row);

        })
        .on("end", async () => {

          const batch = db.batch();

          // DELETE OLD STUDENTS
          const existingStudents =
            await db.collection("student_master").get();

          existingStudents.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });

          students.forEach(student => {

            const email =
              student.email ||
              student.Email ||
              student.EMAIL;

            if (!email) return;

            const ref =
              db.collection("student_master")
                .doc(email.trim().toLowerCase());

            batch.set(ref, {

              name:
                student.name ||
                student.Name ||
                "",

              email:
                email.trim().toLowerCase(),

              rollNo:
                student.rollNo ||
                student.RollNo ||
                student.rollno ||
                "",

              semester:
                student.semester ||
                student.Semester ||
                "",

              department:
                student.department ||
                student.Department ||
                "",

              role: "student",

              updatedAt: new Date()

            });

          });

          await batch.commit();

          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            count: students.length
          });

        });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Student upload failed"
      });

    }

});

app.post("/validate-signup", async (req, res) => {

  const {
    role,
    email,
    rollNo,
    department,
    semester
  } = req.body;

  try {

    if(
  email.trim().toLowerCase() ===
  "iamrein22@gmail.com"
){
  return res.json({
    valid:true,
    role:"admin"
  });
}
    if(role === "teacher"){

      const teacherDoc = await db
        .collection("teacher_master")
        .doc(email.toLowerCase())
        .get();

      if(!teacherDoc.exists){
        return res.json({
          valid:false,
          message:"Teacher not found"
        });
      }

      const teacher = teacherDoc.data();

if(
  String(teacher.department).trim().toLowerCase()
  !==
  String(department).trim().toLowerCase()
){
        return res.json({
          valid:false,
          message:"Department mismatch"
        });
      }

      return res.json({ valid:true });
    }

    const studentDoc = await db
      .collection("student_master")
      .doc(email.toLowerCase())
      .get();

    if(!studentDoc.exists){
      return res.json({
        valid:false,
        message:"Student not found"
      });
    }

    const student = studentDoc.data();

if(
  String(student.rollNo).trim().toLowerCase()
  !==
  String(rollNo).trim().toLowerCase()
){
      return res.json({
        valid:false,
        message:"Roll number mismatch"
      });
    }

if(
  String(student.department).trim().toLowerCase()
  !==
  String(department).trim().toLowerCase()
){
      return res.json({
        valid:false,
        message:"Department mismatch"
      });
    }

if(
  String(student.semester).trim()
  !==
  String(semester).trim()
){
      return res.json({
        valid:false,
        message:"Semester mismatch"
      });
    }

    return res.json({ valid:true });

  } catch(err){

    console.error(err);

    res.status(500).json({
      valid:false
    });
  }
});

app.post("/validate-login", async (req, res) => {

  const { role, email, rollNo } = req.body;
  if(
  email.trim().toLowerCase() ===
  "iamrein22@gmail.com"
){
  return res.json({
    valid:true,
    role:"admin"
  });
}

  try {

    if(role === "teacher"){

      const doc = await db
        .collection("teacher_master")
        .doc(email.toLowerCase())
        .get();

      if(!doc.exists){
        return res.json({ valid:false });
      }

      return res.json({ valid:true });
    }

    const doc = await db
      .collection("student_master")
      .doc(email.toLowerCase())
      .get();

    if(!doc.exists){
      return res.json({ valid:false });
    }

    if(doc.data().rollNo !== rollNo){
      return res.json({ valid:false });
    }

    return res.json({ valid:true });

  } catch(err){
    console.error(err);
    res.status(500).json({ valid:false });
  }

});
/* ================= FALLBACK ================= */

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

/* ================= START SERVER ================= */

app.listen(5000, () => {
  console.log("🚀 Server running at http://localhost:5000");
});
