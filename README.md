# 🌸 MindBloom

> An AI-powered, accessibility-first learning platform designed to help students — especially those with dyslexia — study more comfortably, effectively, and confidently.
> **Built for dyslexic learners. Beneficial for everyone.**

---

## 🌟 Overview

MindBloom is an intelligent learning platform built with an accessibility-first approach. It is specifically designed to support students with dyslexia by simplifying content, reducing cognitive overload, and improving focus.

At the same time, MindBloom is **not limited to dyslexic learners** — it is a powerful tool for **anyone who wants to learn faster, understand concepts more easily, and study in a stress-free environment**.

The platform combines AI-powered assistance with thoughtful user experience design to make learning more engaging, structured, and inclusive.

---

## 🎯 Problem Statement

Many students struggle with:

* Complex and hard-to-understand study materials
* Lack of personalized learning support
* Difficulty maintaining focus and consistency
* Limited accessibility tools for different learning needs

Students with dyslexia face these challenges even more intensely due to:

* Difficulty in reading and processing text
* Cognitive overload from dense content
* Lack of adaptive learning platforms

---

## 💡 Solution

MindBloom addresses these challenges by:

* Simplifying complex content using AI
* Providing personalized study assistance
* Creating structured study plans
* Making learning interactive and engaging
* Ensuring accessibility for diverse learners

---

## 🚀 Key Features

### ⚙️ Accessibility Settings Panel

Customize your learning experience with:

* Dyslexia-friendly fonts (OpenDyslexic, Lexend, Atkinson Hyperlegible)
* Adjustable font size, spacing, and layout
* Multiple visual themes
* Soothing background sounds (ocean, rain, breeze)

---

### 🤖 AI Study Assistant

A smart floating chatbot that helps with:

* Simplified explanations
* Instant doubt clarification
* Multi-subject academic support

---

### 📖 AI Text Simplification

* Convert complex text into simple language
* Break long sentences into readable chunks
* Generate:

  * Key Points
  * Summaries
  * Examples
  * Mindmaps
  * Layman explanations
* Text-to-Speech support for better understanding

---

### 📅 Smart Study Planner

* Create personalized study schedules
* Auto-balance subjects with break time
* Pomodoro Timer & Focus Mode
* Track completion and earn rewards

---

### 🎮 Gamified Learning

* Auto-generate quizzes from study material
* Improve retention with active recall
* Earn points and rewards

---

### 🧘 Break-Time Activities

* Memory games, puzzles, and mini activities
* Breathing exercises and meditation
* Motivational quotes to stay encouraged

---

### 📊 Student Dashboard

* Track study time, streaks, and performance
* Visual analytics and progress reports

---

### 👨‍🏫 Teacher / Parent Dashboard

* Monitor student progress
* Analyze consistency and performance
* Track activity and engagement

---

## 🧑‍💻 Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS        |
| Backend  | FastAPI, Python                     |
| AI       | Groq API (LLaMA)                    |
| Voice    | Web Speech API, SpeechSynthesis API |
| Diagrams | Mermaid.js                          |

---

## 📁 Project Structure

```
MindBloom/
│
├── frontend/               # React + Vite frontend
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # App pages
│   │   ├── lib/            # Utilities & API helpers
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── main.py         # API routes & app entry point
│   │   └── services/
│   │       ├── ai.py       # AI integration (Groq)
│   │       └── extract.py  # Document extraction
│   ├── requirements.txt
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

* Node.js v18+
* Python 3.10+
* Groq API Key

---

### 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/MindBloom.git
cd MindBloom
```

---

### 2️⃣ Backend Setup

```bash
cd backend

python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Add GROQ_API_KEY

uvicorn app.main:app --reload
```

Backend: http://localhost:8000

---

### 3️⃣ Frontend Setup

```bash
cd frontend

npm install

cp .env.example .env

npm run dev
```

Frontend: http://localhost:5173

---

## 🔑 Environment Variables

### backend/.env

```env
GROQ_API_KEY=your_groq_api_key
CORS_ORIGINS=http://localhost:5173
```

### frontend/.env

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## ✨ Highlights

* Accessibility-first design
* AI-powered learning assistance
* Simplified content for better understanding
* Gamified and engaging experience
* Smart scheduling with productivity tools
* Inclusive platform for all learners

---

## 🧠 Future Improvements

* Personalized AI tutors
* Adaptive difficulty system
* Mobile application
* Offline support
* Collaborative study groups
* Voice-based learning mode

---

## 🤝 Contributing

Contributions are welcome to improve accessibility, enhance AI features, and expand learning capabilities.

Steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a Pull Request

---

## 🏆 Why This Project Matters

MindBloom is more than just a study tool — it is a step toward **inclusive education**.

It empowers:

* Students with dyslexia
* Learners struggling with complex content
* Anyone seeking a simpler way to learn

---

## ❤️ About

MindBloom is built with the vision that:

> *“Learning should be accessible, inclusive, and empowering for everyone.”*

Technology has the power to transform education — when designed with empathy.

---
