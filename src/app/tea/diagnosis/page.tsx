"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Role = "assistant" | "user";
type ChatMsg = { role: Role; text: string };
type Suggestion = { name: string; reason: string };

function seasonalGreeting() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const h = now.getHours();

  let time = "こんにちは";
  if (h >= 5 && h < 12) time = "おはようございます";
  else if (h >= 12 && h < 17) time = "こんにちは";
  else if (h >= 17 && h < 23) time = "こんばんは";
  else time = "遅くまでお疲れさまです";

  let hint = "";
  if (m >= 3 && m <= 5) hint = "春の空気を少し感じますね";
  else if (m >= 6 && m <= 8) hint = "暑さに少し疲れやすい時期ですね";
  else if (m >= 9 && m <= 11) hint = "落ち着いた空気を感じる季節ですね";
  else hint = "体が冷えやすい季節ですね";

  return `${time}。${hint}`;
}

function TypingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 360);
    return () => clearInterval(id);
  }, []);
  return <span>{dots}</span>;
}

export default function DiagnosisPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0); // 0→3
  const [ended, setEnded] = useState(false);

  // 初回：挨拶→2秒後に誘導
  const greeting = useMemo(() => seasonalGreeting(), []);
  useEffect(() => {
    setTyping(true);
    const t1 = setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: `🍵 茶ソムリエ：${greeting}` }]);
    }, 600);
    const t2 = setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "🍵 茶ソムリエ：今の悩みや気分をひとこと教えてください。" },
      ]);
      setTyping(false);
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [greeting]);

  const historyForAPI = () =>
    messages.slice(-8).map((m) => ({ role: m.role, text: m.text.replace(/^🍵 茶ソムリエ：/, "") }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || ended) return;

    const userText = input.trim();
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          suggestionCount,
          history: historyForAPI(),
        }),
      });
      const data = await res.json();

      // assistant_messages（前置きなど）を順に表示
      if (Array.isArray(data?.assistant_messages)) {
        let delay = 200;
        data.assistant_messages.forEach((t: string) => {
          setTimeout(() => {
            setMessages((arr) => [...arr, { role: "assistant", text: `🍵 茶ソムリエ：${t}` }]);
          }, (delay += 250));
        });
      }

      // 提案があれば1つだけ表示
      if (data?.suggestion?.name) {
        const n = suggestionCount + 1;
        setTimeout(() => {
          setMessages((arr) => [
            ...arr,
            {
              role: "assistant",
              text: `🍵 茶ソムリエ：提案${n}「${data.suggestion.name}」— ${data.suggestion.reason}`,
            },
          ]);
          setSuggestionCount(n);
        }, 700);
      }

      // 終了 or フォローアップ質問
      if (data?.end) {
        const closing = data?.closing ?? "今日はこのあたりでおすすめは以上です。";
        setTimeout(() => {
          setMessages((arr) => [...arr, { role: "assistant", text: `🍵 茶ソムリエ：${closing}` }]);
          setEnded(true);
        }, 1200);
      } else if (data?.followup_question) {
        setTimeout(() => {
          setMessages((arr) => [
            ...arr,
            { role: "assistant", text: `�� 茶ソムリエ：${data.followup_question}` },
          ]);
        }, 1100);
      }
    } catch {
      setMessages((arr) => [
        ...arr,
        { role: "assistant", text: "🍵 茶ソムリエ：うまく受け取れなかったみたい。もう一度だけ試せますか？" },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function resetAll() {
    setMessages([]);
    setSuggestionCount(0);
    setEnded(false);
    // 再度挨拶
    const greet = seasonalGreeting();
    setMessages([
      { role: "assistant", text: `🍵 茶ソムリエ：${greet}` },
      { role: "assistant", text: "🍵 茶ソムリエ：今の悩みや気分をひとこと教えてください。" },
    ]);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7faf7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 24,
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>お茶診断AI 🍵</h1>

      <Image
        src="/teaAI.png"
        alt="茶ソムリエ"
        width={280}
        height={280}
        style={{ objectFit: "contain", borderRadius: 16 }}
        priority
      />

      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        {/* チャット表示 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "#e0f2fe" : "#f0fdf4",
                color: m.role === "user" ? "#0c4a6e" : "#166534",
                border: `1px solid ${m.role === "user" ? "#7dd3fc" : "#86efac"}`,
                padding: "10px 12px",
                borderRadius: 12,
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {m.text}
            </div>
          ))}
          {typing && (
            <div
              style={{
                alignSelf: "flex-start",
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #86efac",
                padding: "10px 12px",
                borderRadius: 12,
                maxWidth: "60%",
                fontFamily: "monospace",
              }}
            >
              🍵 茶ソムリエ：<TypingDots />
            </div>
          )}
        </div>

        {/* 入力 */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              ended ? "新しく始めるにはリセットを押してください" : "例: 疲れた / 集中したい / 眠れない など"
            }
            rows={2}
            required={!ended}
            disabled={ended}
            style={{
              flex: 1,
              border: "2px solid #000",
              borderRadius: 8,
              padding: 10,
              fontSize: 15,
              background: ended ? "#f1f5f9" : "#fff",
              color: "#000000",
            }}
          />
          <button
            type="submit"
            disabled={ended}
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              cursor: ended ? "not-allowed" : "pointer",
              opacity: ended ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            送信
          </button>
          {ended && (
            <button
              type="button"
              onClick={resetAll}
              style={{
                background: "#334155",
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              リセット
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
