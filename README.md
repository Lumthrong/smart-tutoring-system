# Smart Tutoring System

## Build Environment Setup

### 1. Install Node.js

Download and install Node.js from the official website:

https://nodejs.org

After installation, verify that Node.js and npm are available:

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

After installation, verify:

```bash
python --version
pip --version
```

---

### 3. Install Project Dependencies

Open a terminal in the project root directory and run:

```bash
npm install
```

This will install all required Node.js dependencies for the Smart Tutoring System.

---

### 4. Install Python Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

---

### 5. Environment Variable Configuration

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

#### Obtain Required API Keys

##### Brevo API Key

Used for sending emails and notifications.

1. Visit https://www.brevo.com
2. Create an account and log in.
3. Navigate to **Settings → SMTP & API → API Keys**
4. Generate a new API key.
5. Copy the key and paste it into:

```env
BREVO_API_KEY=your_brevo_api_key
```

##### Cloudinary Credentials

Used for storing and managing uploaded files and images.

1. Visit https://cloudinary.com
2. Create an account and log in.
3. Open the Dashboard.
4. Copy the following values:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

##### Email User

Used as the sender email address for notifications.

```env
EMAIL_USER=your_email@example.com
```

##### Firebase Service Account

Used for secure server-side access to Firebase services.

1. Visit https://console.firebase.google.com
2. Select your Firebase project.
3. Navigate to **Project Settings → Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file.
6. Copy the entire JSON content and store it as:

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

##### Groq API Key

Used for AI-powered quiz generation and tutoring features.

1. Visit https://console.groq.com
2. Sign in or create an account.
3. Navigate to **API Keys**
4. Create a new API key.

```env
GROQ_API_KEY=your_groq_api_key
```

##### Gemini API Key

Used for AI content generation and educational assistance.

1. Visit https://aistudio.google.com
2. Sign in with a Google account.
3. Click **Get API Key**
4. Create a new API key.

```env
GEMINI_API_KEY=your_gemini_api_key
```

> **Important:** Never commit the `.env` file to version control. Add `.env` to your `.gitignore` file.

---

### 6. Firebase Security Rules

If you are setting up the Smart Tutoring System for the first time, use the Firebase security rules provided in the `firebase-rules.txt` file included in the project.

#### Firestore Rules

1. Open the Firebase Console.
2. Navigate to **Firestore Database → Rules**.
3. Copy the contents of `firebase-rules.txt`.
4. Paste the rules into the editor.
5. Click **Publish**.

#### Storage Rules

1. Navigate to **Storage → Rules**.
2. Copy the Storage rules from `firebase-rules.txt`.
3. Paste them into the editor.
4. Click **Publish**.

> **Important:** The Smart Tutoring System is designed to work with the rules provided in `firebase-rules.txt`. Modifying these rules may cause authentication, course management, enrollments, quizzes, file uploads, and other system features to function incorrectly.

---

## Running the Smart Tutoring System

### 1. Start the Backend Server

Open a terminal in the project root directory and run:

```bash
node server.js
```

This will start the Smart Tutoring System backend server.

---

### 2. Start the Whisper Transcription Service

For video lecture transcription, run the provided batch file:

```bash
start.bat
```

This will launch the Whisper model service required for automatic video lecture transcription and processing.

> **Note:** Ensure that all dependencies are installed, environment variables are configured, and Firebase rules have been published before starting the application.
