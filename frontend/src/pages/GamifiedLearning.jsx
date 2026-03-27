import React, { useState, useRef } from "react";
import { apiFetch } from "../lib/api.js";
import { recordActivity } from "../lib/tracker.js";

function HighlightedText({ text, activeWordIndex }) {
  const words = (text || "").split(/(\s+)/);
  let wordIdx = 0;
  return (
    <span>
      {words.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>;
        const idx = wordIdx++;
        return (
          <span key={i} className={`readable-word ${idx === activeWordIndex ? "word-highlight" : ""}`}>{token}</span>
        );
      })}
    </span>
  );
}

export default function GamifiedLearning() {
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState("");
  const [quizCount, setQuizCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState([]);
  const [currentSet, setCurrentSet] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [answered, setAnswered] = useState(false);
  const [phase, setPhase] = useState("setup");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  async function onUpload(file) {
    if (!file) return;
    setFileName(file.name);
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      setFileText(await file.text());
      return;
    }
    // Read as base64, send as JSON — avoids multipart/python-multipart issues
    try {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await apiFetch("/api/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_b64: b64, filename: file.name }),
      });
      setFileText(data.text || "");
    } catch (err) { window.dispatchEvent(new CustomEvent("mb:toast", { detail: { msg: "Extraction failed: " + (err.message || "Make sure the backend is running."), type: "error" } })); }
  }

  async function generate(isMore = false) {
    const src = (mode === "text" ? text : fileText).trim();
    if (!src) { alert("Please add study text first."); return; }
    setBusy(true);
    try {
      const data = await apiFetch("/api/quiz", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: src, count: Number(quizCount) || 6,
          exclude: isMore ? usedQuestions.map(q => q.question) : []
        }),
      });
      const qs = Array.isArray(data.questions) ? data.questions : [];
      if (!isMore) {
        setUsedQuestions(qs); setCurrentSet(qs); setScore(0); setTotalScore(0);
        setIdx(0); setFeedback(""); setAnswered(false); setPhase("quiz");
      } else {
        setUsedQuestions(prev => [...prev, ...qs]); setCurrentSet(qs);
        setIdx(0); setScore(0); setFeedback(""); setAnswered(false); setPhase("quiz");
      }
    } catch (e) { window.dispatchEvent(new CustomEvent("mb:toast", { detail: { msg: "Quiz generation failed: " + (e.message || "Make sure the backend is running."), type: "error" } })); }
    finally { setBusy(false); }
  }

  function answer(choiceIndex) {
    if (answered) return;
    const q = currentSet[idx]; if (!q) return;
    setAnswered(true);
    stopReading();
    const correct = Number(q.answerIndex);
    if (choiceIndex === correct) {
      setScore(s => s + 10); setTotalScore(s => s + 10);
      setFeedback(`✅ Correct! ${q.explanation || ""}`);
    } else {
      setFeedback(`❌ Not quite. The answer is: "${q.choices?.[correct]}". ${q.explanation || ""}`);
    }
    setTimeout(() => {
      setFeedback(""); setAnswered(false);
      if (idx < currentSet.length - 1) setIdx(i => i + 1);
      else setPhase("done");
    }, 2200);
  }

  function readQuestion() {
    const q = currentSet[idx]; if (!q) return;
    window.speechSynthesis.cancel();
    const choiceLetters = ["A", "B", "C", "D"];
    const fullText = `${q.question}. The provided options are: ${q.choices.map((c, i) => `${choiceLetters[i]}. ${c}`).join(". ")}`;
    const u = new SpeechSynthesisUtterance(fullText);
    u.rate = 0.88; u.pitch = 1.05;
    u.onboundary = (e) => {
      if (e.name === "word") {
        const spoken = fullText.substring(0, e.charIndex);
        setActiveWordIndex(spoken.split(/\s+/).filter(Boolean).length);
      }
    };
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => { setIsSpeaking(false); setActiveWordIndex(-1); };
    u.onerror = () => { setIsSpeaking(false); setActiveWordIndex(-1); };
    window.speechSynthesis.speak(u);
  }

  function stopReading() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false); setActiveWordIndex(-1);
  }

  const q = currentSet[idx];

  // Build full text for highlighting (question + "The provided options are:" + choices)
  const fullQuizText = q ? `${q.question} The provided options are: ${(q.choices||[]).map((c,i) => `${["A","B","C","D"][i]}. ${c}`).join(" ")}` : "";
  const questionWordCount = q ? q.question.split(/\s+/).filter(Boolean).length : 0;
  const optionsPhraseWordCount = 4; // "The provided options are:"
  const optionsStart = questionWordCount + optionsPhraseWordCount;

  return (
    <div className="gamified-page">
      <div className="page-header">
        <h2 className="card-title">🎮 Gamified Learning</h2>
        <p className="card-subtitle">Turn your notes into quizzes and earn points!</p>
      </div>

      {phase === "setup" && (
        <div>
          <div className="chip-row">
            <button className={`chip ${mode === "text" ? "chip-primary" : ""}`} type="button" onClick={() => setMode("text")}>📝 Paste Text</button>
            <button className={`chip ${mode === "upload" ? "chip-primary" : ""}`} type="button" onClick={() => setMode("upload")}>📁 Upload Document</button>
          </div>

          {mode === "text" && (
            <textarea className="text-area" rows={7} value={text} onChange={e => setText(e.target.value)}
              placeholder="Paste your study notes here. AI will create quiz questions from them!" />
          )}
          {mode === "upload" && (
            <div className="upload-area">
              <label className="upload-zone" htmlFor="quiz-upload">
                <span className="upload-icon">📁</span>
                <span>{fileName ? `✅ ${fileName}` : "Click to upload .txt, .pdf, or .docx"}</span>
              </label>
              <input id="quiz-upload" type="file" hidden accept=".txt,.pdf,.docx" onChange={e => onUpload(e.target.files?.[0])} />
              {fileText && <div className="file-preview">✅ {fileText.length} characters loaded</div>}
            </div>
          )}

          <div className="quiz-count-row">
            <label className="settings-label" htmlFor="quizCount">🔢 Number of questions: <strong>{quizCount}</strong></label>
            <div className="quiz-count-controls">
              <input id="quizCount" type="range" min="3" max="15" value={quizCount} className="settings-range"
                onChange={e => setQuizCount(Number(e.target.value))} />
              <span className="quiz-count-value">{quizCount} questions</span>
            </div>
          </div>

          <button className="btn-primary btn-large" type="button" onClick={() => generate(false)} disabled={busy}>
            {busy ? "🤖 Generating…" : "🎯 Generate Quiz"}
          </button>
        </div>
      )}

      {phase === "quiz" && q && (
        <div className="quiz-container">
          <div className="quiz-progress">
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${((idx + 1) / currentSet.length) * 100}%` }}></div>
            </div>
            <div className="quiz-progress-text">Question {idx + 1} of {currentSet.length}</div>
          </div>
          <div className="quiz-top-row">
            <div className="quiz-score">⭐ Score: {totalScore}</div>
            <div className="quiz-read-btn">
              {isSpeaking
                ? <button className="btn-ghost btn-sm" onClick={stopReading}>⏹ Stop</button>
                : <button className="btn-ghost btn-sm" onClick={readQuestion}>🔊 Read Aloud</button>}
            </div>
          </div>

          <div className="quiz-question">
            <div className="quiz-question-text">
              {isSpeaking
                ? <HighlightedText text={q.question} activeWordIndex={activeWordIndex} />
                : q.question}
            </div>
          </div>

          {isSpeaking && (
            <div className="options-label">The provided options are:</div>
          )}

          <div className="quiz-choices">
            {(q.choices || []).map((c, i) => {
              const choiceWordOffset = optionsStart + q.choices.slice(0, i).join(" ").split(/\s+/).filter(Boolean).length + i;
              return (
                <button key={i}
                  className={`quiz-choice ${answered && i === Number(q.answerIndex) ? "quiz-choice-correct" : ""} ${answered && i !== Number(q.answerIndex) ? "quiz-choice-wrong" : ""}`}
                  type="button" onClick={() => answer(i)} disabled={answered}>
                  <span className="choice-letter">{["A","B","C","D"][i]}</span>
                  <span>
                    {isSpeaking
                      ? <HighlightedText text={c} activeWordIndex={activeWordIndex - (optionsStart + i * 3)} />
                      : c}
                  </span>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`quiz-feedback ${feedback.startsWith("✅") ? "feedback-correct" : "feedback-wrong"}`}>
              {feedback}
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="quiz-done">
          <div className="quiz-done-trophy">🏆</div>
          <h3>Quiz Complete!</h3>
          <div className="quiz-done-score">You scored <strong>{score}</strong> points this round!</div>
          <div className="quiz-done-total">Total: <strong>{totalScore}</strong> points earned</div>
          <div className="actions-row" style={{ justifyContent: "center", marginTop: 20 }}>
            <button className="btn-primary" onClick={() => generate(true)} disabled={busy}>
              {busy ? "Generating…" : "➕ More Questions"}
            </button>
            <button className="btn-ghost" onClick={() => { setPhase("setup"); setUsedQuestions([]); setTotalScore(0); }}>
              📝 New Topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
