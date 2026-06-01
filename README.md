````md
# smart-tutoring-system

# Build Environment Setup and install dependencies

## 1. Install Node.js

Download and install Node.js from the official website:

https://nodejs.org

After installation, verify using:

```bash
node -v
npm -v
```

---

## 2. Install Python

Download and install Python from the official website:

https://www.python.org/downloads/

During installation:

- Enable Add Python to PATH
- Install pip package manager

After installation, verify using:

```bash
python --version
pip --version
```
````
````md
# Install Dependencies, Libraries and Packages

## Install nodejs Dependencies

Install the required Node.js packages using npm:

```bash
npm install express
npm install firebase
npm install firebase-admin
npm install multer
npm install csv-parser
npm install cors
npm install dotenv
npm install axios
npm install pdfjs-dist
npm install chart.js
npm install cloudinary
npm install tesseract.js
npm install openai
npm install @google/generative-ai
```

---
If package.json exists in project root, install dependencies using command:
```bash
npm install
```

## Install Development Dependency

Install Nodemon for automatic server restart during development:

```bash
npm install --save-dev nodemon
```

---

## Install Python Dependencies

Install Python libraries required for AI transcription and processing:

```bash
pip install openai-whisper
pip install ffmpeg-python
```

---

## Install FFmpeg

Download and install FFmpeg from:

https://ffmpeg.org/download.html

After installation, add FFmpeg to the system PATH.

Verify installation using:

```bash
ffmpeg -version
```

---

## Build Environment Ready

After installing all dependencies, libraries, and packages, the Smart Tutoring System environment is ready for development and execution.
````
