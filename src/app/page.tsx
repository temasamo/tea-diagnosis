"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7faf7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 24,
        gap: 24,
      }}
    >
      {/* ヘッダー */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, color: "#166534", marginBottom: 16 }}>
          お茶診断AI 🍵
        </h1>
        <p style={{ fontSize: 18, color: "#374151", maxWidth: 600, lineHeight: 1.6 }}>
          あなたの心と体にぴったりのお茶を見つけましょう。<br />
          2つの診断スタイルからお選びください。
        </p>
      </div>

      {/* メイン画像 */}
      <Image 
        src="/teaAI.png" 
        alt="茶ソムリエ" 
        width={300} 
        height={300} 
        style={{ objectFit: "contain", marginBottom: 32 }} 
        priority 
      />

      {/* チャット選択カード */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
        gap: 24, 
        maxWidth: 800, 
        width: "100%" 
      }}>
        {/* チャットVer1 - 詳細診断 */}
        <Link href="/tea/diagnosis" style={{ textDecoration: "none" }}>
          <div style={{
            background: "#fff",
            border: "2px solid #16a34a",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            transition: "transform 0.2s, box-shadow 0.2s",
            cursor: "pointer",
            textAlign: "center"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
          }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#166534", marginBottom: 12 }}>
              詳細診断チャット
            </h2>
            <p style={{ color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>
              じっくりとお話を聞いて、あなたに最適なお茶を見つけます。<br />
              たくさんの質問で、あなたの心と体の状態を詳しく診断。
            </p>
            <div style={{
              background: "#16a34a",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 8,
              fontWeight: 600,
              display: "inline-block"
            }}>
              診断を始める
            </div>
          </div>
        </Link>

        {/* チャットVer2 - クイック診断 */}
        <Link href="/tea/quick-diagnosis" style={{ textDecoration: "none" }}>
          <div style={{
            background: "#fff",
            border: "2px solid #7c3aed",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            transition: "transform 0.2s, box-shadow 0.2s",
            cursor: "pointer",
            textAlign: "center"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
          }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#7c3aed", marginBottom: 12 }}>
              クイック診断チャット
            </h2>
            <p style={{ color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>
              ほぼ提携の質問で、すぐにお茶・甘味料・お茶菓子を提案。<br />
              忙しい時でも、すぐに最適な組み合わせが見つかります。
            </p>
            <div style={{
              background: "#7c3aed",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 8,
              fontWeight: 600,
              display: "inline-block"
            }}>
              診断を始める
            </div>
          </div>
        </Link>
      </div>

      {/* 管理画面リンク */}
      <div style={{ 
        marginTop: 32, 
        textAlign: "center" 
      }}>
        <Link href="/admin" style={{ textDecoration: "none" }}>
          <div style={{
            background: "#f59e0b",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 8,
            fontWeight: 600,
            display: "inline-block",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#d97706";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f59e0b";
          }}
          >
            🔧 管理画面
          </div>
        </Link>
      </div>

      {/* フッター */}
      <div style={{ 
        marginTop: 48, 
        textAlign: "center", 
        color: "#9ca3af",
        fontSize: 14 
      }}>
        <p>🍵 あなたの心と体に寄り添う、お茶診断AI</p>
      </div>
    </main>
  );
}