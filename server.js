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
import nodemailer from "nodemailer";
import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);

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

    await transporter.sendMail({
  from: '"Smart Tutor" <iamrein22@gmail.com>',
  to: email,
  subject: "Smart Tutor Verification Code",
  html: `
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

<p style="color:#777;font-size:13px">
If you didn't request this email, ignore it.
</p>

</div>

</div>

</div>
`
});

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

  if(!data){
    return res.status(400).json({error:"OTP expired"});
  }

  if(Date.now() > data.expires){
    otpStore.delete(email);
    return res.status(400).json({error:"OTP expired"});
  }

  if(String(data.otp) !== otp){
    return res.status(400).json({error:"Invalid OTP"});
  }

  otpStore.delete(email);

otpStore.set(email,{
  otp,
  expires: Date.now() + 10 * 60 * 1000
});

  res.json({ success: true });

});

/* ================= SET USER ROLE CLAIM ================= */

app.post("/set-role", async (req,res)=>{

  const { uid, role } = req.body;

  if(!uid || !role)
    return res.status(400).json({error:"uid and role required"});

  try{

    await admin.auth().setCustomUserClaims(uid,{
      role: role
    });

    res.json({success:true});

  }catch(err){

    console.error("SET ROLE ERROR:",err);
    res.status(500).json({error:"Failed to set role"});

  }

});
/* ================= COURSE UPLOAD ================= */

const multiUpload = upload.fields([
  { name: "cover", maxCount: 1 },
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
    const coverFile = req.files.cover ? req.files.cover[0] : null;

let coverUpload = null;

if (coverFile) {

  coverUpload = await cloudinary.uploader.upload(coverFile.path,{
    folder:"uploads/covers"
  });

}

    /* ================= EXTRACT PDF TEXT ================= */

    let extractedText = null;

    try {
      const pdfBuffer = fs.readFileSync(pdfFile.path);
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text.substring(0,15000);
    } catch(err){
      console.error("PDF PARSE ERROR:",err);
    }

    /* ================= CLOUDINARY PDF UPLOAD ================= */

    const pdfUpload = await cloudinary.uploader.upload(pdfFile.path,{
      resource_type:"raw",
      folder:"uploads/pdfs"
    });

    /* ================= CLOUDINARY VIDEO UPLOAD ================= */

    let videoUpload = null;

    if(videoFile){

      videoUpload = await cloudinary.uploader.upload(videoFile.path,{
        resource_type:"auto",
        folder:"uploads/videos"
      });

    }

    /* ================= DELETE TEMP FILES ================= */

    fs.unlinkSync(pdfFile.path);
    if(videoFile) fs.unlinkSync(videoFile.path);
    if(coverFile) fs.unlinkSync(coverFile.path);

    res.json({
  success:true,
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
  catch(err){

    console.error("UPLOAD ERROR:",err);
    res.status(500).json({ error:"Upload failed" });

  }

});

/* ================= DELETE FILE ================= */

app.delete("/delete-course/:publicId", async (req, res) => {

  try {

    const publicId = req.params.publicId;

    if (!publicId)
      return res.status(400).json({ error: "File id required" });

    await cloudinary.uploader.destroy(publicId,{
      resource_type:"auto"
    });

    res.json({ success:true });

  }
  catch(err){

    console.error("DELETE ERROR:",err);
    res.status(500).json({ error:"Delete failed" });

  }

});

/* ================= PROFILE IMAGE UPLOAD ================= */

app.post("/upload-profile", upload.single("profile"), async (req, res) => {

  try {

    if (!req.file)
      return res.status(400).json({ success:false });

    const uploadResult = await cloudinary.uploader.upload(req.file.path,{
      folder:"uploads/profiles"
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success:true,
      fileURL: uploadResult.secure_url,
      filename: uploadResult.public_id
    });

  }
  catch(err){

    console.error("PROFILE UPLOAD ERROR:",err);
    res.status(500).json({ success:false });

  }

});

/* ================= AI TEST GENERATION ================= */

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

    const pdfData = await pdfParse(pdfBuffer);

    /* ================= CLEAN + SPLIT TEXT ================= */

    const words = pdfData.text
      .replace(/\s+/g, " ")
      .split(" ");

    if(words.length < 1000){
      return res.status(400).json({ error:"PDF text too small for quiz generation" });
    }

    /* ================= RANDOM CHUNK (AVOIDS TOKEN LIMITS) ================= */

    const chunkSize = 1200;

    const start = Math.floor(
      Math.random() * Math.max(1, words.length - chunkSize)
    );

    const text = words.slice(start, start + chunkSize).join(" ");

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

Create 5 university-level MCQs ONLY from the study material below.

Rules:
- Questions must come from the syllabus.
- Avoid general knowledge.
- Avoid cover pages or introductions.
- Each question must test understanding.

Return STRICT JSON:

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
      parsed = JSON.parse(raw);
    } catch {

      const match = raw.match(/\{[\s\S]*\}/);

      if (!match) {
        console.error("AI JSON PARSE FAILED:", raw);
        return res.status(500).json({ error: "AI response invalid JSON" });
      }

      parsed = JSON.parse(match[0]);

    }

    res.json(parsed);

  } catch (err) {

    console.error("AI ERROR:", err);
    res.status(500).json({ error: "AI failed" });

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
