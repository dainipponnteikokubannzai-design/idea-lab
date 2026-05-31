import { useState, useRef, useEffect } from "react";

const FREE_LIMIT = 3;
const PREMIUM_CODE = "IDEALAB2026"; // Noteのサブスクメンバーへのコードはここで設定

const SYSTEM_PROMPT = `あなたは天才的なアイデアパートナーです。ユーザーのアイデアや悩みを聞いて、以下のスタイルで壁打ちします：

- 鋭い質問でアイデアを深掘りする
- 意外な視点や切り口を提示する
- 具体的なアクションや次のステップを提案する
- 短く、刺激的な返答を心がける（長すぎない）
- 時に挑発的・provocativeな問いかけをして思考を揺さぶる

日本語で返答してください。`;

const THINKING_MESSAGES = [
  "考え中...", "思考を展開中...", "アイデアを編んでいます...", "深掘り中...", "新しい角度を探しています..."
];

function Orbs() {
  return (
    <div className="orbs-container" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`orb orb-${i + 1}`} />
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="typing-dots">
      <span /><span /><span />
    </span>
  );
}

// ---- Paywall モーダル ----
function PaywallModal({ onUnlock, onClose }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const tryUnlock = () => {
    if (code.trim().toUpperCase() === PREMIUM_CODE) {
      onUnlock();
    } else {
      setError("コードが正しくありません");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="modal-overlay">
      <div className={`modal-box ${shake ? "shake" : ""}`}>
        <div className="modal-icon">🔐</div>
        <div className="modal-title">3回の無料枠を使い切りました</div>
        <div className="modal-desc">
          続けるには、Noteメンバーシップに加入して<br />
          プレミアムコードを入力してください。
        </div>
        <a
          className="note-btn"
          href="https://note.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          ✦ Noteでメンバーになる
        </a>
        <div className="divider"><span>すでにメンバーの方</span></div>
        <input
          className="code-input"
          type="text"
          placeholder="プレミアムコードを入力"
          value={code}
          onChange={e => { setCode(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && tryUnlock()}
          autoFocus
        />
        {error && <div className="code-error">{error}</div>}
        <button className="unlock-btn" onClick={tryUnlock}>解放する</button>
        <button className="close-btn" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

// ---- カウンターバッジ ----
function UsageBadge({ used, isPremium }) {
  if (isPremium) return (
    <div className="badge premium">✦ プレミアム</div>
  );
  return (
    <div className="badge free">
      残り <strong>{FREE_LIMIT - used}</strong> / {FREE_LIMIT} 回
    </div>
  );
}

export default function IdeaLab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingMsg, setThinkingMsg] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const thinkingIntervalRef = useRef(null);

  // localStorageで状態を永続化
  useEffect(() => {
    try {
      const saved = localStorage.getItem("idealab_usage");
      if (saved) setUsageCount(parseInt(saved, 10));
      const prem = localStorage.getItem("idealab_premium");
      if (prem === "true") setIsPremium(true);
    } catch {}
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const startThinking = () => {
    let i = 0;
    setThinkingMsg(THINKING_MESSAGES[0]);
    thinkingIntervalRef.current = setInterval(() => {
      i = (i + 1) % THINKING_MESSAGES.length;
      setThinkingMsg(THINKING_MESSAGES[i]);
    }, 900);
  };

  const stopThinking = () => {
    clearInterval(thinkingIntervalRef.current);
    setThinkingMsg("");
  };

  const handleUnlock = () => {
    setIsPremium(true);
    setShowPaywall(false);
    try { localStorage.setItem("idealab_premium", "true"); } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // 無料枠チェック
    if (!isPremium && usageCount >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    startThinking();

    // 使用回数カウント
    if (!isPremium) {
      const next = usageCount + 1;
      setUsageCount(next);
      try { localStorage.setItem("idealab_usage", String(next)); } catch {}
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newMessages,
        }),
      });

      const data = await response.json();
      const assistantText = data.content?.map(b => b.text || "").join("") || "エラーが発生しました。";
      setMessages([...newMessages, { role: "assistant", content: assistantText }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "接続エラーが発生しました。もう一度お試しください。" }]);
    } finally {
      setLoading(false);
      stopThinking();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  };

  const inputBlocked = !isPremium && usageCount >= FREE_LIMIT;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Noto+Sans+JP:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0f;
          font-family: 'Noto Sans JP', sans-serif;
          color: #f0ece8;
          min-height: 100vh;
          overflow: hidden;
        }

        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: relative;
          overflow: hidden;
        }

        .orbs-container { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.18; animation: drift linear infinite; }
        .orb-1 { width: 500px; height: 500px; background: radial-gradient(circle, #dc143c, transparent); top: -15%; left: -10%; animation-duration: 22s; }
        .orb-2 { width: 400px; height: 400px; background: radial-gradient(circle, #ffd700, transparent); top: 40%; right: -8%; animation-duration: 28s; animation-delay: -8s; }
        .orb-3 { width: 350px; height: 350px; background: radial-gradient(circle, #1e90ff, transparent); bottom: -10%; left: 20%; animation-duration: 20s; animation-delay: -4s; }
        .orb-4 { width: 300px; height: 300px; background: radial-gradient(circle, #00ced1, transparent); top: 15%; right: 30%; animation-duration: 32s; animation-delay: -12s; }
        .orb-5 { width: 250px; height: 250px; background: radial-gradient(circle, #ff1493, transparent); bottom: 30%; right: 10%; animation-duration: 18s; animation-delay: -6s; }
        .orb-6 { width: 450px; height: 450px; background: radial-gradient(circle, #50c878, transparent); top: 60%; left: -5%; animation-duration: 26s; animation-delay: -15s; }

        @keyframes drift {
          0%   { transform: translateY(0px) translateX(0px) rotate(0deg); }
          25%  { transform: translateY(-40px) translateX(30px) rotate(90deg); }
          50%  { transform: translateY(-20px) translateX(-20px) rotate(180deg); }
          75%  { transform: translateY(30px) translateX(10px) rotate(270deg); }
          100% { transform: translateY(0px) translateX(0px) rotate(360deg); }
        }

        /* Header */
        .header {
          position: relative; z-index: 10;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,15,0.6);
          backdrop-filter: blur(20px);
          display: flex; align-items: center; justify-content: space-between;
        }
        .header-left { display: flex; align-items: baseline; gap: 10px; }
        .header-title {
          font-family: 'Syne', sans-serif; font-size: 1.4rem; font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #dc143c 0%, #ffd700 50%, #1e90ff 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .header-sub { font-size: 0.68rem; color: rgba(240,236,232,0.3); letter-spacing: 0.12em; text-transform: uppercase; }

        /* Badge */
        .badge {
          font-size: 0.72rem; padding: 5px 12px; border-radius: 20px;
          font-family: 'Syne', sans-serif; font-weight: 700; letter-spacing: 0.04em;
        }
        .badge.free {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          color: rgba(240,236,232,0.5);
        }
        .badge.free strong { color: #ffd700; }
        .badge.premium {
          background: linear-gradient(135deg, rgba(220,20,60,0.2), rgba(255,215,0,0.15));
          border: 1px solid rgba(255,215,0,0.3);
          color: #ffd700;
        }

        /* Messages */
        .messages-area {
          flex: 1; overflow-y: auto; padding: 24px 16px; position: relative; z-index: 5;
        }
        .messages-area::-webkit-scrollbar { width: 4px; }
        .messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; gap: 14px; text-align: center; animation: fadeIn 0.8s ease;
        }
        .empty-icon { font-size: 3rem; filter: drop-shadow(0 0 20px rgba(220,20,60,0.4)); animation: pulse 2.5s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .empty-title { font-family: 'Syne', sans-serif; font-size: 1.15rem; font-weight: 700; color: rgba(240,236,232,0.85); }
        .empty-desc { font-size: 0.8rem; color: rgba(240,236,232,0.35); max-width: 260px; line-height: 1.7; }
        .starter-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 320px; margin-top: 6px; }
        .chip {
          padding: 6px 13px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03); font-size: 0.73rem; color: rgba(240,236,232,0.55);
          cursor: pointer; transition: all 0.2s ease; backdrop-filter: blur(8px);
        }
        .chip:hover { border-color: rgba(220,20,60,0.5); color: rgba(240,236,232,0.9); background: rgba(220,20,60,0.08); transform: translateY(-1px); }

        .message-row { display: flex; margin-bottom: 16px; animation: slideUp 0.35s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .message-row.user { justify-content: flex-end; }
        .message-row.assistant { justify-content: flex-start; }

        .bubble { max-width: 82%; padding: 11px 15px; border-radius: 18px; font-size: 0.87rem; line-height: 1.75; }
        .bubble.user {
          background: linear-gradient(135deg, rgba(220,20,60,0.85), rgba(180,10,40,0.9));
          border-radius: 18px 18px 4px 18px; color: #fff;
          box-shadow: 0 4px 18px rgba(220,20,60,0.22);
        }
        .bubble.assistant {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px 18px 18px 4px; backdrop-filter: blur(12px); color: rgba(240,236,232,0.9);
        }

        .thinking-row { display: flex; margin-bottom: 16px; animation: slideUp 0.35s ease; }
        .thinking-bubble {
          padding: 11px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px 18px 18px 4px; display: flex; align-items: center; gap: 10px;
          font-size: 0.78rem; color: rgba(240,236,232,0.38);
        }
        .typing-dots { display: flex; gap: 4px; align-items: center; }
        .typing-dots span { width: 5px; height: 5px; border-radius: 50%; background: rgba(220,20,60,0.7); animation: bounce 1.2s infinite; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-6px); opacity: 1; } }

        /* Input */
        .input-area {
          position: relative; z-index: 10; padding: 12px 14px 16px;
          background: rgba(10,10,15,0.7); backdrop-filter: blur(24px);
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .input-box {
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 9px 9px 9px 15px; transition: border-color 0.2s ease;
        }
        .input-box:focus-within { border-color: rgba(220,20,60,0.45); background: rgba(255,255,255,0.07); }
        .input-box.blocked { opacity: 0.4; pointer-events: none; }
        textarea {
          flex: 1; background: transparent; border: none; outline: none;
          color: #f0ece8; font-family: 'Noto Sans JP', sans-serif; font-size: 0.87rem;
          line-height: 1.6; resize: none; height: 38px; min-height: 38px; max-height: 160px; overflow-y: auto;
        }
        textarea::placeholder { color: rgba(240,236,232,0.22); }

        .send-btn {
          width: 36px; height: 36px; border-radius: 11px; border: none;
          background: linear-gradient(135deg, #dc143c, #b00c28); color: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s ease; box-shadow: 0 2px 12px rgba(220,20,60,0.3);
        }
        .send-btn:hover:not(:disabled) { transform: scale(1.06); box-shadow: 0 4px 20px rgba(220,20,60,0.5); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ペイウォールバナー */
        .paywall-banner {
          margin: 0 14px 10px;
          padding: 13px 16px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(220,20,60,0.12), rgba(255,215,0,0.08));
          border: 1px solid rgba(220,20,60,0.25);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          animation: slideUp 0.4s ease;
        }
        .banner-text { font-size: 0.78rem; color: rgba(240,236,232,0.7); line-height: 1.5; }
        .banner-text strong { color: #ffd700; display: block; margin-bottom: 2px; font-family: 'Syne', sans-serif; }
        .banner-btn {
          flex-shrink: 0; padding: 8px 14px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #dc143c, #b00c28); color: #fff;
          font-size: 0.75rem; font-family: 'Syne', sans-serif; font-weight: 700;
          cursor: pointer; white-space: nowrap; transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(220,20,60,0.3);
        }
        .banner-btn:hover { transform: scale(1.04); box-shadow: 0 4px 20px rgba(220,20,60,0.5); }

        .hint { text-align: center; font-size: 0.66rem; color: rgba(240,236,232,0.16); margin-top: 7px; letter-spacing: 0.05em; }

        /* ---- モーダル ---- */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(5,5,10,0.85); backdrop-filter: blur(16px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: fadeIn 0.25s ease;
        }
        .modal-box {
          background: #0f0f18; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px; padding: 32px 28px; max-width: 360px; width: 100%;
          text-align: center; box-shadow: 0 30px 80px rgba(0,0,0,0.6);
          animation: scaleIn 0.3s ease;
        }
        @keyframes scaleIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .shake { animation: shakeX 0.4s ease; }
        @keyframes shakeX { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }

        .modal-icon { font-size: 2.8rem; margin-bottom: 12px; }
        .modal-title { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 800; margin-bottom: 10px; color: #f0ece8; }
        .modal-desc { font-size: 0.8rem; color: rgba(240,236,232,0.5); line-height: 1.7; margin-bottom: 20px; }

        .note-btn {
          display: block; padding: 12px; border-radius: 14px; margin-bottom: 20px;
          background: linear-gradient(135deg, #dc143c, #b00c28);
          color: #fff; font-family: 'Syne', sans-serif; font-size: 0.85rem; font-weight: 700;
          text-decoration: none; transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(220,20,60,0.35);
        }
        .note-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(220,20,60,0.5); }

        .divider { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
        .divider span { font-size: 0.7rem; color: rgba(240,236,232,0.3); white-space: nowrap; }

        .code-input {
          width: 100%; padding: 11px 14px; border-radius: 12px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
          color: #f0ece8; font-size: 0.88rem; font-family: 'Syne', sans-serif;
          outline: none; text-align: center; letter-spacing: 0.1em; margin-bottom: 8px;
          transition: border-color 0.2s;
        }
        .code-input:focus { border-color: rgba(220,20,60,0.5); }
        .code-error { font-size: 0.73rem; color: #ff6b6b; margin-bottom: 10px; }

        .unlock-btn {
          width: 100%; padding: 12px; border-radius: 12px; border: none; margin-bottom: 10px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: rgba(240,236,232,0.8); font-size: 0.85rem; font-family: 'Syne', sans-serif;
          font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .unlock-btn:hover { background: rgba(255,255,255,0.12); color: #f0ece8; }

        .close-btn {
          width: 100%; padding: 9px; border-radius: 10px; border: none;
          background: transparent; color: rgba(240,236,232,0.25); font-size: 0.75rem;
          cursor: pointer; transition: color 0.2s;
        }
        .close-btn:hover { color: rgba(240,236,232,0.5); }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="app">
        <Orbs />

        {showPaywall && (
          <PaywallModal
            onUnlock={handleUnlock}
            onClose={() => setShowPaywall(false)}
          />
        )}

        <header className="header">
          <div className="header-left">
            <span className="header-title">IDEA LAB</span>
            <span className="header-sub">AI壁打ちスタジオ</span>
          </div>
          <UsageBadge used={usageCount} isPremium={isPremium} />
        </header>

        <div className="messages-area">
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">💡</div>
              <div className="empty-title">アイデアを壁打ちしよう</div>
              <div className="empty-desc">どんな悩みやアイデアでも。AIが鋭い問いで深掘りします。</div>
              <div className="starter-chips">
                {["新しいビジネスを考えたい", "副業のアイデアが欲しい", "企画が行き詰まった", "独自の強みを見つけたい"].map(s => (
                  <button key={s} className="chip" onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role}`}>
              <div className={`bubble ${msg.role}`}>{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="thinking-row">
              <div className="thinking-bubble">
                <TypingDots />
                <span>{thinkingMsg}</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {inputBlocked && (
          <div className="paywall-banner">
            <div className="banner-text">
              <strong>無料枠を使い切りました</strong>
              プレミアムコードで無制限に使えます
            </div>
            <button className="banner-btn" onClick={() => setShowPaywall(true)}>
              解放する →
            </button>
          </div>
        )}

        <div className="input-area">
          <div className={`input-box ${inputBlocked ? "blocked" : ""}`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={inputBlocked ? "プレミアム会員限定" : "アイデアや悩みを入力..."}
              disabled={loading || inputBlocked}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim() || inputBlocked}
              aria-label="送信"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          {!inputBlocked && <div className="hint">Enter で送信 · Shift+Enter で改行</div>}
        </div>
      </div>
    </>
  );
}
