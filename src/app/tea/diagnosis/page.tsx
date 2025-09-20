"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";

type Role = "assistant" | "user";
type ChatMsg = { role: Role; text: string };
type TeaSuggestion = { 
  tea: string; 
  reason: string; 
  brewing: string; 
  sweetener: string; 
  food: string; 
  timing: string; 
};
type ChatHistory = { role: Role; text: string };

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
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [ended, setEnded] = useState(false);
  const [diagnosisPhase, setDiagnosisPhase] = useState("collecting");
  const [userProfile, setUserProfile] = useState<any>({});
  const [currentSuggestion, setCurrentSuggestion] = useState<TeaSuggestion | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const askedFollowupsRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // 新規/更新メッセージ・タイピングインジケータのたびに最下部へ
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // 初回：挨拶→2秒後に質問開始
  const greeting = useMemo(() => seasonalGreeting(), []);
  useEffect(() => {
    setTyping(true);
    const t1 = setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: `🍵 茶ソムリエ：${greeting}` }]);
    }, 600);
    const t2 = setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "🍵 茶ソムリエ：今日はどんなお茶をお探しですか？あなたのお好みやお悩みなどお聞かせいただければ最適なお茶をご提案できますので、遠慮なくおっしゃってください。" },
      ]);
      setTyping(false);
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [greeting]);

  const historyForAPI = () =>
    messages.slice(-8).map((m) => ({ role: m.role, text: m.text.replace(/^🍵 茶ソムリエ：/, "") }));

  // 包括的提案の表示
  const displayComprehensiveSuggestion = (suggestion: TeaSuggestion) => {
    const suggestionText = `🍵 茶ソムリエ：あなたにぴったりのお茶をご提案させていただきます！

【おすすめのお茶】
${suggestion.tea}
理由：${suggestion.reason}

【最適な飲み方】
${suggestion.brewing}

【合う甘味料】
${suggestion.sweetener}

【合う食べ物】
${suggestion.food}

【おすすめのタイミング】
${suggestion.timing}`;

    setMessages(prev => [...prev, { role: "assistant", text: suggestionText }]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || ended || processingRef.current) return;

    const userText = input.trim();
    processingRef.current = true;
    
    // 終了意図のチェック
    if (userText.includes("最後") || userText.includes("終わり") || userText.includes("もう大丈夫") || userText.includes("ありがとう")) {
      setMessages(prev => [...prev, { role: "user", text: userText }]);
      setInput("");
      setTyping(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", text: "🍵 茶ソムリエ：ありがとうございました。お茶でリフレッシュしてくださいね！" }]);
        setEnded(true);
        setTyping(false);
        processingRef.current = false;
      }, 1000);
      return;
    }

    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setInput("");
    setTyping(true);

    // ユーザープロフィールを更新
    const updatedProfile = { ...userProfile, [diagnosisPhase]: userText };
    setUserProfile(updatedProfile);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          suggestionCount,
          history: historyForAPI(),
          askedFollowups: askedFollowupsRef.current,
          lowEnergyHint: userText.includes("疲") || userText.includes("だる") || userText.includes("しんど"),
          diagnosisPhase,
          userProfile: updatedProfile
        }),
      });
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();

      // フェーズを更新
      if (data?.phase) {
        setDiagnosisPhase(data.phase);
      }

      // assistant_messages（前置きなど）を順に表示
      if (Array.isArray(data?.assistant_messages)) {
        const delay = 200;
        data.assistant_messages.forEach((t: string, index: number) => {
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", text: `🍵 茶ソムリエ：${t}` }]);
          }, delay + (index * 250));
        });
      }

      // 包括的提案の表示
      if (data?.suggestion) {
        setTimeout(() => {
          displayComprehensiveSuggestion(data.suggestion);
          setCurrentSuggestion(data.suggestion);
          setSuggestionCount(prev => prev + 1);
        }, 700);
      }

      // 診断質問の表示
      if (data?.diagnosis_question) {
        setTimeout(() => {
          setMessages(prev => [...prev, { role: "assistant", text: `🍵 茶ソムリエ：${data.diagnosis_question}` }]);
          askedFollowupsRef.current.push(data.diagnosis_question);
        }, 1100);
      }

      // 経験確認
      if (data?.experience_check) {
        setTimeout(() => {
          setMessages(prev => [...prev, { role: "assistant", text: "🍵 茶ソムリエ：このお茶を飲んだことがありますか？もし飲んだことがあれば、その時の印象はいかがでしたか？" }]);
        }, 1500);
      }

    } catch (error) {
      console.error("エラー詳細:", error);
      setMessages(prev => [...prev, { role: "assistant", text: "🍵 茶ソムリエ：申し訳ありません。システムエラーが発生しました。もう一度お試しください。" }]);
    } finally {
      setTyping(false);
      processingRef.current = false;
    }
  }

  function resetAll() {
    setMessages([]);
    setSuggestionCount(0);
    setEnded(false);
    setDiagnosisPhase("collecting");
    setUserProfile({});
    setCurrentSuggestion(null);
    askedFollowupsRef.current = [];
    processingRef.current = false;
    
    // 再度挨拶
    const greet = seasonalGreeting();
    setMessages([
      { role: "assistant", text: `🍵 茶ソムリエ：${greet}` },
      { role: "assistant", text: "🍵 茶ソムリエ：今日はどんなお茶をお探しですか？あなたのお好みやお悩みなどお聞かせいただければ最適なお茶をご提案できますので、遠慮なくおっしゃってください。" },
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

      {/* チャットカード（高さ固定） */}
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: 520,
          overflow: "hidden",
        }}
      >
        {/* スクロールするメッセージ領域（カード内） */}
        <div
          ref={chatScrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
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
        </div>

        {/* 入力フォーム（カード下部に固定） */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              ended ? "新しく始めるにはリセットを押してください" : 
              diagnosisPhase === "confirming" ? "例: 飲んだことがある / 飲んだことがない / 苦手だった など" :
              "お答えください"
            }
            rows={2}
            required={!ended}
            disabled={ended || processingRef.current}
            style={{
              flex: 1,
              border: "2px solid #000",
              borderRadius: 8,
              padding: 10,
              fontSize: 15,
              background: ended || processingRef.current ? "#f1f5f9" : "#fff",
              color: "#000000",
            }}
          />
          <button
            type="submit"
            disabled={ended || processingRef.current}
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              cursor: ended || processingRef.current ? "not-allowed" : "pointer",
              opacity: ended || processingRef.current ? 0.6 : 1,
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
