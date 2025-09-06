"use client";

import { useState } from "react";
import Image from "next/image";

export default function DiagnosisPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "400px",
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
          }}
        >
          {loading ? "診断中..." : "診断する"}
        </button>
      </form>

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
          {/* 診断結果ボックス */}
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
                lineHeight: "1.5",
              }}
            >
              {result}
            </p>
          </div>

          {/* キャラ画像（右横に配置） */}
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
