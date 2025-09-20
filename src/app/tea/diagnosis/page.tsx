"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";

type Role = "assistant" | "user";
type ChatMsg = { role: Role; text: string };
type Suggestion = { name: string; reason: string };
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

// 文字列正規化関数（重複チェック用）
function norm(s: string): string {
  return s.toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "");
}

export default function DiagnosisPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [ended, setEnded] = useState(false);
  const [lastUserInput, setLastUserInput] = useState("");
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(new Set());
  const [timeChecked, setTimeChecked] = useState(false);
  
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const askedFollowupsRef = useRef<string[]>([]);

  // 新規/更新メッセージ・タイピングインジケータのたびに最下部へ
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

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
    messages.slice(-6).map((m) => ({ role: m.role, text: m.text.replace(/^🍵 茶ソムリエ：/, "") }));

  // 重複チェック付きメッセージ追加
  const addMessageSafely = (role: Role, text: string) => {
    const messageKey = `${role}:${text}`;
    if (processedMessages.has(messageKey)) {
      console.log("重複メッセージをスキップ:", text);
      return;
    }
    setProcessedMessages(prev => new Set([...prev, messageKey]));
    setMessages(prev => [...prev, { role, text }]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || ended) return;

    const userText = input.trim();
    
    // 終了意図のチェック
    if (userText.includes("最後") || userText.includes("終わり") || userText.includes("もう大丈夫") || userText.includes("ありがとう")) {
      addMessageSafely("user", userText);
      setInput("");
      setTyping(true);
      setTimeout(() => {
        addMessageSafely("assistant", "🍵 茶ソムリエ：ありがとうございました。お茶でリフレッシュしてくださいね！");
        setEnded(true);
        setTyping(false);
      }, 1000);
      return;
    }

    setLastUserInput(userText);
    addMessageSafely("user", userText);
    setInput("");
    setTyping(true);

    try {
      console.log("API呼び出し開始:", { 
        text: userText, 
        suggestionCount, 
        history: historyForAPI(),
        askedFollowups: askedFollowupsRef.current,
        lowEnergyHint: userText.includes("疲") || userText.includes("だる") || userText.includes("しんど")
      });
      
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          suggestionCount,
          history: historyForAPI(),
          askedFollowups: askedFollowupsRef.current,
          lowEnergyHint: userText.includes("疲") || userText.includes("だる") || userText.includes("しんど")
        }),
      });
      
      console.log("APIレスポンス:", res.status, res.statusText);
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("APIデータ:", data);

      // assistant_messages（前置きなど）を順に表示
      if (Array.isArray(data?.assistant_messages)) {
        const delay = 200;
        data.assistant_messages.forEach((t: string, index: number) => {
          setTimeout(() => {
            addMessageSafely("assistant", `🍵 茶ソムリエ：${t}`);
          }, delay + (index * 250));
        });
      }

      // 提案があれば1つだけ表示
      if (data?.suggestion?.name) {
        const n = suggestionCount + 1;
        setTimeout(() => {
          const suggestionText = `そんな方には「${data.suggestion.name}」がおすすめです。${data.suggestion.reason}`;
          addMessageSafely("assistant", `🍵 茶ソムリエ：${suggestionText}`);
          setSuggestionCount(n);
        }, 700);
      }

      // 時間確認（5回提案後）
      if (data?.time_check && !timeChecked) {
        setTimeout(() => {
          addMessageSafely("assistant", "🍵 茶ソムリエ：お時間大丈夫ですか？お茶の話をもう少し続けてもよろしいでしょうか？");
          setTimeChecked(true);
        }, 1200);
        return;
      }

      // フォローアップ質問の重複チェック
      if (data?.followup_question) {
        const normalizedQuestion = norm(data.followup_question);
        const isDuplicate = askedFollowupsRef.current.some(asked => 
          norm(asked) === normalizedQuestion || 
          (norm(asked).includes("温") && norm(data.followup_question).includes("温")) ||
          (norm(asked).includes("冷") && norm(data.followup_question).includes("冷"))
        );

        if (isDuplicate) {
          console.log("重複質問を検出、代替質問を使用");
          const alternatives = [
            "カフェインの有無は気になりますか？",
            "香りの強いお茶と控えめなお茶、どちらがお好みですか？",
            "甘いお茶とすっきりしたお茶、どちらがお好みですか？",
            "お茶を淹れる時間はありますか？",
            "お茶と一緒に何かお菓子はいかがですか？"
          ];
          const alternative = alternatives[Math.floor(Math.random() * alternatives.length)];
          setTimeout(() => {
            addMessageSafely("assistant", `🍵 茶ソムリエ：${alternative}`);
            askedFollowupsRef.current.push(alternative);
          }, 1100);
        } else {
          setTimeout(() => {
            addMessageSafely("assistant", `🍵 茶ソムリエ：${data.followup_question}`);
            askedFollowupsRef.current.push(data.followup_question);
          }, 1100);
        }
      }

      // 終了処理
      if (data?.end) {
        const closing = data?.closing ?? "今日はこのあたりでおすすめは以上です。";
        setTimeout(() => {
          addMessageSafely("assistant", `🍵 茶ソムリエ：${closing}`);
          setEnded(true);
        }, 1200);
      }
    } catch (error) {
      console.error("エラー詳細:", error);
      addMessageSafely("assistant", "🍵 茶ソムリエ：申し訳ありません。システムエラーが発生しました。もう一度お試しください。");
    } finally {
      setTyping(false);
    }
  }

  function resetAll() {
    setMessages([]);
    setSuggestionCount(0);
    setEnded(false);
    setLastUserInput("");
    setProcessedMessages(new Set());
    setTimeChecked(false);
    askedFollowupsRef.current = [];
    
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
          height: 520,          // ★カード自体の高さを固定
          overflow: "hidden",   // ★外側にスクロールが出ないように隠す
        }}
      >
        {/* スクロールするメッセージ領域（カード内） */}
        <div
          ref={chatScrollRef}
          style={{
            flex: 1,
            overflowY: "auto",   // ★ここに縦スクロールが出る
            paddingRight: 6,     // スクロールバー余白
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
