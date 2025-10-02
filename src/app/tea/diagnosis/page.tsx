"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "assistant" | "user";
type ChatMsg = { role: Role; text: string };
type Suggestion = { 
  tea: string; 
  reason: string; 
  brewing: string; 
  sweetener: string; 
  food: string; 
  timing: string; 
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

// ── しんどい時モード：ユーザー文に低エネルギー表現があるか ───────
function isLowEnergy(text: string) {
  return /しんど|つら|疲れ|だる|きつ|元気ない|やる気|無理|重い/.test(text);
}

// ── 提案メッセージを文脈に合わせてやさしく言い換え ───────────
function renderSuggestion(s: Suggestion, turn: number, userText: string) {
  const { tea, reason, brewing, sweetener, food, timing } = s;
  if (isLowEnergy(userText)) {
    return `まずはやさしい一杯から。「${tea}」はいかがでしょう。${reason}\n\n【飲み方】${brewing}\n【甘味料】${sweetener}\n【合う食べ物】${food}\n【おすすめタイミング】${timing}`;
  }
  if (/眠|寝|リラックス/.test(userText)) {
    return `リラックスしたい時には「${tea}」がおすすめです。${reason}\n\n【飲み方】${brewing}\n【甘味料】${sweetener}\n【合う食べ物】${food}\n【おすすめタイミング】${timing}`;
  }
  return `そんな方には「${tea}」がおすすめです。${reason}\n\n【飲み方】${brewing}\n【甘味料】${sweetener}\n【合う食べ物】${food}\n【おすすめタイミング】${timing}`;
}

// ── 文字列正規化（重複チェック用） ─────────────────────────
function norm(s: string) {
  return s.replace(/[。、！？\s]/g, "").toLowerCase();
}

export default function DiagnosisPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0); // 0→3
  const [ended, setEnded] = useState(false);
  const [phase, setPhase] = useState<"collecting" | "suggesting" | "confirming">("collecting");
  
  const lastUserTextRef = useRef("");
  const askedFollowupsRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 新規/更新メッセージ・タイピングインジケータのたびに最下部へ
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // 初回：挨拶→誘導
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

  // APIに渡す軽量履歴
  const historyForAPI = () =>
    messages.slice(-8).map(m => ({ role: m.role, text: m.text.replace(/^🍵 茶ソムリエ：/, "") }));

  // 「終わりたい」即終了ワード
  const END_PATTERNS = ["もう大丈夫", "大丈夫です", "最後と言った", "終わり", "結構です", "ありがとう", "十分です", "これでいい", "ない", "大丈夫", "ありません", "特にない"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || ended) return;

    const userText = input.trim();
    lastUserTextRef.current = userText;

    // 即終了フレーズ検知（お茶の提案が完了していない場合は無効）
    if (suggestionCount < 3 && END_PATTERNS.some(p => userText.includes(p))) {
      setMessages(m => [...m, { role: "user", text: userText }]);
      setInput("");
      setTyping(true);
      setTimeout(() => {
        setMessages(arr => [...arr, { role: "assistant", text: "🍵 茶ソムリエ：もう少し詳しくお聞かせください。最適なお茶をご提案させていただきますので。" }]);
        setTyping(false);
      }, 420);
      return;
    }
    
    // お茶の提案が完了した後の終了フレーズ検知
    if (suggestionCount >= 3 && END_PATTERNS.some(p => userText.includes(p))) {
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
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          suggestionCount,
          history: historyForAPI(),
          askedFollowups: askedFollowupsRef.current,
          lowEnergyHint: isLowEnergy(userText),
          diagnosisPhase: phase,
          userProfile: {},
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      
      // デバッグ用ログ
      console.log("API Response:", data);

      // フェーズ更新
      if (data?.phase) {
        setPhase(data.phase);
      }

      // 前置きメッセージ（共感・理解）のみ表示
      if (Array.isArray(data?.assistant_messages)) {
        data.assistant_messages.forEach((t: string, idx: number) => {
          setTimeout(() => {
            setMessages(arr => [...arr, { role: "assistant", text: `🍵 茶ソムリエ：${t}` }]);
          }, 180 + idx * 240);
        });
      }

      // お茶の提案
      if (data?.suggestion?.tea) {
        const turn = suggestionCount; // 0,1,2
        const text = renderSuggestion(data.suggestion as Suggestion, turn, lastUserTextRef.current);
        setTimeout(() => {
          setMessages(arr => [...arr, { role: "assistant", text: `🍵 茶ソムリエ：${text}` }]);
          setSuggestionCount(turn + 1);
        }, 650);
      }

      // 診断質問（重複チェック付き）
      if (data?.diagnosis_question) {
        const dq = String(data.diagnosis_question);
        console.log("質問:", dq);
        console.log("過去の質問:", askedFollowupsRef.current);
        const isDup = askedFollowupsRef.current.some(
          q => norm(q) === norm(dq) || norm(dq).includes(norm(q)) || norm(q).includes(norm(dq))
        );
        console.log("重複チェック:", isDup);
        if (!isDup) {
          askedFollowupsRef.current = [...askedFollowupsRef.current.slice(-5), dq];
          setTimeout(() => {
            setMessages(arr => [...arr, { role: "assistant", text: `🍵 茶ソムリエ：${dq}` }]);
          }, 1000);
        } else {
          // 重複検出：お茶提案後の場合は「他にも気になることがありますか？」と聞く
          const fallback = suggestionCount >= 3
            ? "他にも気になることがありますか？"
            : suggestionCount < 2
              ? "では別の切り口でお伺いします。カフェインは控えたいですか？それとも気分転換に少し欲しいですか？"
              : "ここまでで十分な情報が集まりました。最適なお茶をご提案させていただきますね。";
          setTimeout(() => {
            setMessages(arr => [...arr, { role: "assistant", text: `🍵 茶ソムリエ：${fallback}` }]);
          }, 1000);
        }
      }

    } catch (error) {
      console.error("API Error:", error);
      setMessages(arr => [
        ...arr,
        { role: "assistant", text: "🍵 茶ソムリエ：すみません、うまく受け取れませんでした。もう一度だけ送っていただけますか？" },
      ]);
    } finally {
      console.log("Setting typing to false");
      setTyping(false);
    }
  }

  function resetAll() {
    setMessages([]);
    setSuggestionCount(0);
    setEnded(false);
    setPhase("collecting");
    setTyping(false);
    lastUserTextRef.current = "";
    askedFollowupsRef.current = [];
    const greet = seasonalGreeting();
    // 再掲
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
      {/* ヘッダー */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#166534", margin: 0 }}>
          🍵 茶ソムリエ診断
        </h1>
        <p style={{ fontSize: 16, color: "#4b5563", margin: "8px 0 0 0" }}>
          あなたにぴったりのお茶を見つけましょう
        </p>
      </div>

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
              ended
                ? "新しく始めるにはリセットを押してください"
                : phase === "confirming"
                ? "例: 飲んだことがある / 飲んだことがない / 苦手だった など"
                : "例: 疲れた / 集中したい / 眠れない など"
            }
            rows={2}
            required={!ended}
            disabled={ended || typing}
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
            disabled={ended || typing}
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              cursor: ended || typing ? "not-allowed" : "pointer",
              opacity: ended || typing ? 0.6 : 1,
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
