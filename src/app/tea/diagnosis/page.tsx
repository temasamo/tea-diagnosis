"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

/** 季節と時間帯から軽い挨拶を生成 */
function useSeasonalGreeting() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const hour = now.getHours();

  let timeGreeting = "こんにちは";
  if (hour >= 5 && hour < 12) timeGreeting = "おはようございます";
  else if (hour >= 12 && hour < 17) timeGreeting = "こんにちは";
  else if (hour >= 17 && hour < 23) timeGreeting = "こんばんは";
  else timeGreeting = "遅くまでお疲れさまです";

  let seasonHint = "";
  if (month >= 3 && month <= 5) seasonHint = "春の空気を少し感じますね";
  else if (month >= 6 && month <= 8) seasonHint = "暑さに少し疲れやすい時期ですね";
  else if (month >= 9 && month <= 11) seasonHint = "落ち着いた空気を感じる季節ですね";
  else seasonHint = "体が冷えやすい季節ですね";

  return `${timeGreeting}。${seasonHint}`;
}

export default function DiagnosisPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 会話用ステート
  const [showFirstLine, setShowFirstLine] = useState(true);
  const [showSecondLine, setShowSecondLine] = useState(false);

  const greeting = useMemo(() => useSeasonalGreeting(), []);

  useEffect(() => {
    // 2秒後に次のセリフを表示
    const timer = setTimeout(() => {
      setShowSecondLine(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      const data = await res.json();
      setResult(data.message ?? "おすすめが見つかりませんでした。");
    } catch (err) {
      console.error(err);
      setResult("エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "#f9fafb",
      }}
    >
      <h1
        style={{
          color: "#000000",
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "16px",
          textAlign: "center",
        }}
      >
        お茶診断AI 🍵
      </h1>

      {/* キャラ画像を大きく */}
      <div style={{ marginBottom: "16px" }}>
        <Image
          src="/teaAI.png"
          alt="茶ソムリエ"
          width={280} // 以前の約5倍
          height={280}
          style={{ borderRadius: "16px", objectFit: "contain" }}
          priority
        />
      </div>

      {/* 会話風の吹き出し */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: "600px",
          marginBottom: "16px",
        }}
      >
        {showFirstLine && (
          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #16a34a",
              color: "#166534",
              padding: "12px",
              borderRadius: "12px",
              lineHeight: 1.6,
              fontSize: "14px",
            }}
          >
            🍵 茶ソムリエ：{greeting}
          </div>
        )}
        {showSecondLine && (
          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #16a34a",
              color: "#166534",
              padding: "12px",
              borderRadius: "12px",
              lineHeight: 1.6,
              fontSize: "14px",
            }}
          >
            🍵 茶ソムリエ：よければ、今の悩みや気分をひとこと教えてください。
          </div>
        )}
      </div>

      {/* 入力フォーム */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "600px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: 最近眠れないのでリラックスできるお茶が欲しい"
          style={{
            color: "#000000",
            backgroundColor: "#ffffff",
            border: "2px solid #000000",
            borderRadius: "8px",
            padding: "12px",
            width: "100%",
            fontSize: "16px",
            fontFamily: "inherit",
          }}
          rows={3}
          required
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#16a34a",
            color: "#ffffff",
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "診断中..." : "診断する"}
        </button>
      </form>

      {/* 診断結果（右横に立ち絵） */}
      {result && (
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "16px",
              backgroundColor: "#ffffff",
              border: "2px solid #000000",
              borderRadius: "8px",
            }}
          >
            <h2
              style={{
                color: "#000000",
                fontWeight: "bold",
                marginBottom: "8px",
                fontSize: "18px",
              }}
            >
              診断結果
            </h2>
            <p
              style={{
                color: "#000000",
                whiteSpace: "pre-line",
                lineHeight: "1.6",
              }}
            >
              {result}
            </p>
          </div>

          <div style={{ flexShrink: 0 }}>
            <Image
              src="/teaAI.png"
              alt="茶ソムリエ"
              width={180}
              height={180}
              style={{ borderRadius: "8px", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
