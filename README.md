# Smart Tutoring System

A web-based Smart Tutoring System that provides course management, AI-powered quiz generation, video lecture transcription, learning material distribution, performance analytics, and personalized learning recommendations for students and educators.

## Features

* Student Authentication and Authorization
* Teacher and Admin Dashboards
* Course and Subject Management
* AI-Powered Quiz Generation
* Video Lecture Upload and Transcription
* Learning Material Distribution
* Student Performance Analytics
* Personalized Learning Recommendations
* Notifications and Announcements
* Cloud-Based File Storage

---

## Build Environment Setup

### 1. Install Node.js

Download and install Node.js from the official website:

https://nodejs.org

Verify installation:

```bash
node -v
npm -v
```

---

### 2. Install Python

Download and install Python from the official website:

https://www.python.org/downloads/

During installation:

* Enable **Add Python to PATH**
* Ensure **pip** is installed

Verify installation:

```bash
python --version
pip --version
```

---

### 3. Install FFmpeg

FFmpeg is required for video lecture transcription using Whisper.

Download FFmpeg:

https://ffmpeg.org/download.html

Verify installation:

```bash
ffmpeg -version
```

Ensure FFmpeg is added to your system PATH.

---

### 4. Install Project Dependencies

Open a terminal in the project root directory and run:

```bash
npm install
```

---

### 5. Install Python Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

---

## Environment Variable Configuration

Create a `.env` file in the project root directory and add the following environment variables:

```env
BREVO_API_KEY=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_CLOUD_NAME=
EMAIL_USER=
FIREBASE_SERVICE_ACCOUNT=
GROQ_API_KEY=
GEMINI_API_KEY=
```

### Obtain Required API Keys

#### Brevo API Key

Used for sending emails and notifications.

1. Visit https://www.brevo.com
2. Create an account and log in.
3. Navigate to **Settings → SMTP & API → API Keys**
4. Generate a new API key.

```env
BREVO_API_KEY=your_brevo_api_key
```

---

#### Cloudinary Credentials

Used for storing uploaded files and images.

1. Visit https://cloudinary.com
2. Create an account and log in.
3. Open the Dashboard.
4. Copy the following credentials:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

#### Email User

Used as the sender email address for notifications.

```env
EMAIL_USER=your_email@example.com
```

---

#### Firebase Service Account

Used for secure server-side access to Firebase services.

1. Visit https://console.firebase.google.com
2. Select your Firebase project.
3. Navigate to **Project Settings → Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file.
6. Copy the JSON content into:

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

---

#### Groq API Key

Used for AI-powered quiz generation.

1. Visit https://console.groq.com
2. Sign in or create an account.
3. Navigate to **API Keys**
4. Generate a new API key.

```env
GROQ_API_KEY=your_groq_api_key
```

---

#### Gemini API Key

Used for AI-powered educational assistance and content generation.

1. Visit https://aistudio.google.com
2. Sign in with a Google account.
3. Click **Get API Key**
4. Generate a new API key.

```env
GEMINI_API_KEY=your_gemini_api_key
```

> **Important:** Never commit the `.env` file to version control. Add `.env` to your `.gitignore` file.

---

## Firebase Setup

1. Create a Firebase project.
2. Enable **Authentication**.
3. Enable **Firestore Database**.
4. Enable **Storage**.
5. Obtain the Firebase configuration and update `firebase.js`.
6. Apply the Firestore and Storage rules provided in `firebase-rules.txt`.

---

## Firebase Security Rules

If you are setting up the Smart Tutoring System for the first time, use the Firebase security rules provided in the `firebase-rules.txt` file included in the project.

### Firestore Rules

1. Open Firebase Console.
2. Navigate to **Firestore Database → Rules**.
3. Copy the Firestore rules from `firebase-rules.txt`.
4. Paste them into the editor.
5. Click **Publish**.

### Storage Rules

1. Navigate to **Storage → Rules**.
2. Copy the Storage rules from `firebase-rules.txt`.
3. Paste them into the editor.
4. Click **Publish**.

> **Important:** The project is designed to work with the rules provided in `firebase-rules.txt`. Modifying these rules may cause authentication, course management, enrollments, quizzes, file uploads, and other system features to function incorrectly.

---

## Project Structure

```text
smart-tutoring-system/
├── public/
    ├──.html
    ├──/css
        ├──.css
    ├──/js
        ├──.js
├── uploads/
├── server.js
├── firebase.js
├── package.json
├── start.bat
└── .env
```

---

## Running the Smart Tutoring System

### 1. Start the Backend Server

Open a terminal in the project root directory and run:

```bash
node server.js
```

This will start the backend server.

---

### 2. Start the Whisper Transcription Service

Run the provided batch file:

```bash
start.bat
```

This will launch the Whisper transcription service required for video lecture transcription.

> Ensure all dependencies, environment variables, Firebase configuration, and Firebase rules have been properly configured before starting the application.

---

## Accessing the Application

After starting the backend server, open the application in your browser.

Example:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:5000
```

Update the URLs if your project uses different ports.

---

## Troubleshooting

### npm install Fails

Linux/macOS:

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

Windows:

```cmd
rmdir /s /q node_modules
del package-lock.json
npm install
```

### Python Dependency Installation Fails

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Whisper Transcription Not Working

* Verify Python is installed.
* Verify FFmpeg is installed and added to PATH.
* Verify all packages from `requirements.txt` are installed.
* Ensure `start.bat` is running.
* Check the console logs for any transcription-related errors.

---

## License

This project is intended for educational and research purposes.
