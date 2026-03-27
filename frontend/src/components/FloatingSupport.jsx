import React, { useState } from "react";
import AIAssistant from "./AIAssistant.jsx";

export default function FloatingSupport({ aiOpen, onAiOpenChange }) {
  const [encouragement, setEncouragement] = useState("");
  const [loadingEncouragement, setLoadingEncouragement] = useState(false);
  const [showToast, setShowToast] = useState("");

  const triggerEncouragement = async () => {
    if (loadingEncouragement) return;
    setLoadingEncouragement(true);
    try {
      const { apiFetch } = await import("../lib/api.js");
      const data = await apiFetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Give me a very short (2-3 sentences max) encouraging message for a student with dyslexia. Be warm, kind and brief.",
        }),
      });
      const msg = data.answer || "You are amazing! Every step forward is a victory! 🌟";
      setShowToast(msg);
      setTimeout(() => setShowToast(""), 6000);
    } catch {
      setShowToast("You are doing brilliantly! Dyslexia is your superpower. Keep shining! ✨");
      setTimeout(() => setShowToast(""), 5000);
    } finally {
      setLoadingEncouragement(false);
    }
  };

  return (
    <>
      {showToast && (
        <div className="encouragement-toast" role="alert">
          <span className="encouragement-toast-emoji">💪</span>
          <p className="encouragement-toast-text">{showToast}</p>
          <button className="encouragement-toast-close" onClick={() => setShowToast("")}>✕</button>
        </div>
      )}

      <div className="floating-support">
        <button
          className={`encouragement-button ${loadingEncouragement ? "encouragement-loading" : ""}`}
          type="button"
          onClick={triggerEncouragement}
          disabled={loadingEncouragement}
          title="Need a boost? Click for encouragement!"
        >
          {loadingEncouragement ? "💭" : "💪"}
          <span>{loadingEncouragement ? "Loading…" : "Need encouragement?"}</span>
        </button>

        <button
          className="ai-assistant-fab"
          type="button"
          aria-label="Open AI Study Assistant"
          onClick={() => onAiOpenChange(true)}
          title="Open AI Study Assistant"
        >
          <span>🤖</span>
          <span className="fab-label">AI</span>
        </button>
      </div>

      <AIAssistant
        open={aiOpen}
        onClose={() => onAiOpenChange(false)}
        encouragement={encouragement}
        onClearEncouragement={() => setEncouragement("")}
      />
    </>
  );
}
