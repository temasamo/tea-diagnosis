"use client";

import { useState } from "react";

export default function DiagnosisPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // ここで API を呼び出す（仮のエンドポイント）
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">お茶診断AI 🍵</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: 最近眠れないのでリラックスできるお茶が欲しい"
          className="border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-green-400"
          rows={3}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
        >
          {loading ? "診断中..." : "診断する"}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-white shadow rounded-lg w-full max-w-md">
          <h2 className="font-semibold text-lg mb-2">診断結果</h2>
          <p>{result}</p>
        </div>
      )}
    </main>
  );
}
