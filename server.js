import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= PATH SETUP ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ================= SEND OTP ================= */

app.post("/send-otp", async (req, res) => {

  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(email, otp);

  try {

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Smart Tutor OTP Verification",
      text: `Your verification OTP is: ${otp}`
    });

    res.json({ success: true });

  } catch (err) {
    console.error("OTP EMAIL ERROR:", err);
    res.status(500).json({ error: "Email send failed" });
  }

});

/* ================= VERIFY OTP ================= */

app.post("https://smart-tutoring-system.onrender.com/verify-otp", (req, res) => {

  const { email, otp } = req.body;

  const storedOTP = otpStore.get(email);

  if (!storedOTP)
    return res.status(400).json({ error: "OTP expired" });

  if (storedOTP !== otp)
    return res.status(400).json({ error: "Invalid OTP" });

  otpStore.delete(email);

  res.json({ success: true });

});

/* ================= COURSE UPLOAD ================= */

const multiUpload = upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "video", maxCount: 1 }
]);

app.post("/upload", multiUpload, async (req, res) => {

  try {

    const { department, semester, course } = req.body;

    if (!req.files || !req.files.pdf)
      return res.status(400).json({ error: "PDF required" });

    const pdfFile = req.files.pdf[0];
    const videoFile = req.files.video ? req.files.video[0] : null;

    let extractedText = null;

    try {
      const pdfBuffer = fs.readFileSync(pdfFile.path);
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text.substring(0, 15000);
    } catch (err) {
      console.error("PDF PARSE ERROR:", err);
    }

    res.json({
      success: true,
      department,
      semester,
      course,
      pdfFilename: pdfFile.filename,
      pdfURL: "/uploads/" + pdfFile.filename,
      videoFilename: videoFile ? videoFile.filename : null,
      videoURL: videoFile ? "/uploads/" + videoFile.filename : null,
      text: extractedText
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
  }

});

/* ================= DELETE FILE ================= */

app.delete("/delete-course/:filename", (req, res) => {

  try {

    const filePath = path.join(uploadDir, req.params.filename);

    if (fs.existsSync(filePath))
      fs.unlinkSync(filePath);

    res.json({ success: true });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }

});

/* ================= PROFILE IMAGE UPLOAD ================= */

app.post("/upload-profile", upload.single("profile"), async (req, res) => {

  try {

    if (!req.file)
      return res.status(400).json({ success:false });

    res.json({
      success: true,
      fileURL: "/uploads/" + req.file.filename,
      filename: req.file.filename
    });

  } catch (err) {
    console.error("PROFILE UPLOAD ERROR:", err);
    res.status(500).json({ success:false });
  }

});

/* ================= AI TEST GENERATION ================= */

app.post("/generate-test", async (req, res) => {

  const { pdfURL } = req.body;

  if (!pdfURL)
    return res.status(400).json({ error: "PDF URL required" });

  try {

    /* ================= READ PDF FILE ================= */

    const filename = pdfURL.split("/").pop();
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "PDF not found" });

    const pdfBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(pdfBuffer);

    const text = pdfData.text.substring(0,4000);

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
          messages: [{
            role: "user",
            content: `
Generate 5 MCQs from the syllabus below.

Return STRICT JSON:

{
 "questions":[
  {
   "question":"...",
   "options":["A","B","C","D"],
   "answer":"correct option"
  }
 ]
}

Syllabus:
${text}
`
          }]
        })
      }
    );

    const data = await response.json();

    const raw = data.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {

      const match = raw.match(/\{[\s\S]*\}/);

      if (!match)
        return res.status(500).json({ error:"AI response invalid" });

      parsed = JSON.parse(match[0]);
    }

    res.json(parsed);

  } catch (err) {

    console.error("AI ERROR:", err);
    res.status(500).json({ error:"AI failed" });

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
