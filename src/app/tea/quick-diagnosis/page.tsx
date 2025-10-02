"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Role = "assistant" | "user";
type ChatMsg = { role: Role; text: string };
type QuickSuggestion = { 
  tea: string; 
  reason: string; 
  sweetener: string; 
  snack: string; 
  timing: string;
  brewing: string;
};

// ── 季節＋時間の軽いあいさつ ───────────────────────────────
function seasonalGreeting() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const h = now.getHours();
  const time =
    h >= 5 && h < 12 ? "おはようございます" :
    h >= 12 && h < 17 ? "こんにちは" :
    h >= 17 && h < 23 ? "こんばんは" : "遅くまでお疲れさまです";
  const hint =
    m >= 3 && m <= 5 ? "春の空気を少し感じますね" :
    m >= 6 && m <= 8 ? "暑さに少し疲れやすい時期ですね" :
    m >= 9 && m <= 11 ? "落ち着いた空気を感じる季節ですね" :
    "体が冷えやすい季節ですね";
  return `${time}。${hint}`;
}

// ── 打鍵中の「…」 ────────────────────────────────────────
function TypingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d.length >= 3 ? "." : d + ".")), 360);
    return () => clearInterval(id);
  }, []);
  return <span>{dots}</span>;
}

export default function QuickDiagnosisPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [ended, setEnded] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);

  // 内部スクロール（カード内）
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // 初回：あいさつ→誘導
  const greeting = useMemo(() => seasonalGreeting(), []);
  useEffect(() => {
    setTyping(true);
    const t1 = setTimeout(() => {
      setMessages(m => [...m, { role: "assistant", text: `🍵 茶ソムリエ：${greeting}` }]);
    }, 600);
    const t2 = setTimeout(() => {
      setMessages(m => [
        ...m,
        { role: "assistant", text: "🍵 茶ソムリエ：クイック診断を始めます。今の気分や体調をひとことで教えてください。" },
      ]);
      setTyping(false);
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [greeting]);

  // クイック診断の提案データ
  const quickSuggestions: QuickSuggestion[] = [
    {
      tea: "ルイボスティー",
      reason: "カフェインフリーでリラックス効果があり、胃に優しいです",
      sweetener: "蜂蜜（温かいうちに少量）",
      snack: "アーモンドやクルミなどのナッツ",
      timing: "夕方から夜にかけて",
      brewing: "95度のお湯で3-5分蒸らす"
    },
    {
      tea: "ジャスミンティー",
      reason: "香りが高く、気分をリフレッシュしてくれます",
      sweetener: "砂糖（香りを邪魔しない程度）",
      snack: "和菓子や軽いクッキー",
      timing: "午後のリラックスタイム",
      brewing: "80度のお湯で2-3分蒸らす"
    },
    {
      tea: "抹茶",
      reason: "集中力を高め、リラックス効果もあります",
      sweetener: "黒砂糖（抹茶の苦味と相性抜群）",
      snack: "和菓子、特に生菓子",
      timing: "朝の集中したい時間",
      brewing: "70度のお湯で茶筅でよくかき混ぜる"
    },
    {
      tea: "生姜茶",
      reason: "体を温め、胃腸の調子を整えてくれます",
      sweetener: "黒砂糖（生姜の辛味と相性抜群）",
      snack: "温かいお粥や軽いスープ",
      timing: "朝食時や体が冷えた時",
      brewing: "90度のお湯で3分蒸らす"
    },
    {
      tea: "ハーブティー（カモミール）",
      reason: "鎮静効果があり、心を落ち着かせてくれます",
      sweetener: "蜂蜜（自然な甘さで心を癒やす）",
      snack: "フルーツや軽いヨーグルト",
      timing: "就寝前のリラックスタイム",
      brewing: "90度のお湯で5-7分蒸らす"
    }
  ];

  // 終了フレーズ
  const END_PATTERNS = ["もう大丈夫", "大丈夫です", "終わり", "結構です", "ありがとう", "十分です", "これでいい", "ない", "大丈夫", "ありません", "特にない"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || ended) return;

    const userText = input.trim();

    // 終了フレーズ検知
    if (END_PATTERNS.some(p => userText.includes(p))) {
      setMessages(m => [...m, { role: "user", text: userText }]);
      setInput("");
      setTyping(true);
      setTimeout(() => {
        setMessages(arr => [...arr, { role: "assistant", text: "🍵 茶ソムリエ：承知いたしました。またのご来店をお待ちしております。お疲れ様でした。" }]);
        setEnded(true);
        setTyping(false);
      }, 420);
      return;
    }

    // 送信表示
    setMessages(m => [...m, { role: "user", text: userText }]);
    setInput("");
    setTyping(true);

    try {
      // クイック診断の処理
      setTimeout(() => {
        const selectedSuggestion = quickSuggestions[suggestionCount % quickSuggestions.length];
        
        setMessages(arr => [
          ...arr,
          { role: "assistant", text: `🍵 茶ソムリエ：${userText}とのことですね。最適な組み合わせをご提案させていただきます！` }
        ]);
        
        setTimeout(() => {
          setMessages(arr => [
            ...arr,
            { role: "assistant", text: `🍵 茶ソムリエ：\n\n【お茶】${selectedSuggestion.tea}\n${selectedSuggestion.reason}\n\n【甘味料】${selectedSuggestion.sweetener}\n\n【お茶菓子】${selectedSuggestion.snack}\n\n【飲み方】${selectedSuggestion.brewing}\n\n【おすすめタイミング】${selectedSuggestion.timing}` }
          ]);
          setSuggestionCount(prev => prev + 1);
        }, 800);
        
        setTimeout(() => {
          setMessages(arr => [
            ...arr,
            { role: "assistant", text: "🍵 茶ソムリエ：他にも気になることがありますか？" }
          ]);
        }, 2000);
        
        setTyping(false);
      }, 1000);

    } catch (error) {
      console.error("Error:", error);
      setMessages(arr => [
        ...arr,
        { role: "assistant", text: "🍵 茶ソムリエ：すみません、うまく受け取れませんでした。もう一度だけ送っていただけますか？" },
      ]);
      setTyping(false);
    }
  }

  function resetAll() {
    setMessages([]);
    setSuggestionCount(0);
    setEnded(false);
    setTyping(false);
    const greet = seasonalGreeting();
    setMessages([
      { role: "assistant", text: `🍵 茶ソムリエ：${greet}` },
      { role: "assistant", text: "🍵 茶ソムリエ：クイック診断を始めます。今の気分や体調をひとことで教えてください。" },
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
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <Link href="/" style={{ 
          background: "#6b7280", 
          color: "#fff", 
          padding: "8px 16px", 
          borderRadius: 8, 
          textDecoration: "none",
          fontWeight: 600
        }}>
          ← 戻る
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
          クイック診断チャット ⚡
        </h1>
      </div>

      <Image src="/teaAI.png" alt="茶ソムリエ" width={200} height={200} style={{ objectFit: "contain" }} priority />

      {/* チャットカード（内部スクロール） */}
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#fff",
          border: "2px solid #7c3aed",
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
        {/* スクロールする領域 */}
        <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "#e0e7ff" : "#f3e8ff",
                  color: m.role === "user" ? "#3730a3" : "#581c87",
                  border: `1px solid ${m.role === "user" ? "#a5b4fc" : "#c4b5fd"}`,
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
                  background: "#f3e8ff",
                  color: "#581c87",
                  border: "1px solid #c4b5fd",
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

        {/* 入力フォーム */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ended ? "新しく始めるにはリセットを押してください" : "例: 疲れた / 集中したい / 眠れない など"}
            rows={2}
            required={!ended}
            disabled={ended}
            style={{
              flex: 1,
              border: "2px solid #7c3aed",
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
              background: "#7c3aed",
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
