// src/app/api/diagnose/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
// export const runtime = "edge"; // 必要なら有効化

type ReqBody = {
  text?: string;
  suggestionCount?: number; // これまでの提案数（0〜3）
  history?: { role: "user" | "assistant"; text: string }[]; // 直近の会話（任意）
};

export async function POST(req: Request) {
  try {
    const { text, suggestionCount = 0, history = [] }: ReqBody = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "empty", assistant_messages: [], suggestion: null, followup_question: null, end: false, closing: null },
        { status: 400 }
      );
    }

    // 3回出し終わっていたら終了固定
    if (suggestionCount >= 3) {
      return NextResponse.json({
        assistant_messages: [],
        suggestion: null,
        followup_question: null,
        end: true,
        closing: "今日はここまでにしましょう。気になるお茶があれば、ゆっくり選んでくださいね。"
      });
    }

    // ── OpenAI未設定ならモック応答 ───────────────────────────
    if (!openai) {
      const mock = mockTurn(text, suggestionCount);
      return NextResponse.json(mock);
    }

    // ── OpenAIプロンプト ─────────────────────────────────
    const sys = [
      "あなたは日本語で応答する『茶ソムリエAI』です。",
      "会話を通じて合計3回まで、毎回1つだけお茶を提案します。",
      "★重要：ユーザーが『お茶以外』(例: コーヒー/水/炭酸/エナジードリンク/お酒 など) を答えた場合でも、",
      "  1) まず共感して受け止める（例：『コーヒー派なんですね！』）",
      "  2) その飲み物の嗜好（温/冷、甘/さっぱり、カフェイン可否、香りの好み など）を1つだけ質問で深掘りする",
      "  3) その嗜好に\"自然に橋渡しできる\"お茶を1つだけ提案する（例：コーヒー派→焙煎香の強い『ほうじ茶』等）",
      "  4) 無反応や話題無視は禁止。必ず会話を継続する。",
      "",
      "★理解力向上：",
      "  - 「どちらも」「両方」「どっちも」= 複数の選択肢を両方選ぶ意味",
      "  - 「温かいのも冷たいのも好き」= 温度にこだわらない",
      "  - 「甘いのも苦いのも好き」= 味の幅が広い",
      "  - ユーザーの回答を正確に理解し、誤解釈しない",
      "",
      "各ターンでは次を厳守：",
      "  (a) assistant_messages：1〜2文の短い前置き（共感や状況整理）",
      "  (b) suggestion：{name, reason} でお茶を1つだけ提案（複数同時は厳禁）",
      "  (c) followup_question：次の掘り下げ質問を1つだけ",
      "",
      "3回目の提案を出したら end=true とし、やんわり締める closing を入れる（このとき followup_question は出さない）。",
      "",
      "言い回しガイド：",
      "  - 医療アドバイスや断定表現は避け、一般的・控えめに。",
      "  - 初心者/お茶を普段飲まない人には、飲みやすさ・入手しやすさ・カフェイン量の観点を優先。",
      "  - コーヒー派→焙煎香(ほうじ茶/麦茶)、甘い飲料派→フルーティ/ハーブ(ルイボス/ローズヒップ/ハイビスカス)、",
      "    炭酸派→アイスでさっぱり(冷煎茶/ミントブレンド)、エナジー派→気分転換(煎茶/抹茶)、水派→無香/やさしい(三年番茶/ルイボス) などの橋渡し例を参考にする。",
      "",
      "出力は strict JSON のみ：",
      '{ "assistant_messages": string[], "suggestion": { "name": string, "reason": string } | null, "followup_question": string | null, "end": boolean, "closing": string | null }'
    ].join("\n");

    const turnInfo =
      suggestionCount === 0
        ? "これは1回目の提案ターンです。ユーザーの発話に沿って1つだけ提案し、次の質問を1つしてください。"
        : suggestionCount === 1
        ? "これは2回目の提案ターンです。先の会話を踏まえて、重複しない別のお茶を1つ提案し、次の質問を1つしてください。"
        : "これは3回目の提案ターンです。重複しない別のお茶を1つ提案し、end=true としてやんわり締めの closing を入れ、followup_question は出さないでください。";

    const user =
      [
        `ユーザー入力: """${text.trim()}"""`,
        `これまでの提案回数: ${suggestionCount}`,
        turnInfo,
        "注意：ユーザーが『お茶以外』を答えたら、共感→嗜好を質問→自然にお茶へ橋渡しを必ず行うこと。",
        "注意：ユーザーが「どちらも」「両方」など複数選択を示した場合は、その幅広い嗜好を正確に理解すること。",
        "これまでの会話（参考）:",
        JSON.stringify(history.slice(-8)), // 直近だけ渡す
      ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 350,
      response_format: { type: "json_object" } as any,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json(mockTurn(text, suggestionCount)); // フォールバック

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(mockTurn(text, suggestionCount));
    }

    // 最低限の妥当性
    if (
      !("assistant_messages" in parsed) ||
      !Array.isArray(parsed.assistant_messages) ||
      (!parsed.end && (!parsed.followup_question || !parsed.suggestion)) ||
      (parsed.end && !parsed.suggestion)
    ) {
      return NextResponse.json(mockTurn(text, suggestionCount));
    }

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(mockTurn("エラー", 0));
  }
}

// ── 超簡易モック（OpenAI未設定/失敗時用） ─────────────────────
function mockTurn(text: string, suggestionCount: number) {
  const bank = [
    { name: "ほうじ茶", reason: "香ばしく落ち着いた味わい。カフェイン控えめで夜にも。" },
    { name: "カモミール", reason: "やわらかな香りでリラックスしやすいノンカフェイン。" },
    { name: "煎茶", reason: "すっきりした飲み口。気分の切り替えや作業前に。" },
    { name: "ルイボス", reason: "クセが少なく飲みやすいノンカフェイン。" },
    { name: "プーアル", reason: "食後にも合う、まろやかなコクのある味わい。" },
  ];
  const pick = (i: number) => bank[i % bank.length];

  if (suggestionCount >= 2) {
    return {
      assistant_messages: ["気持ちに寄り添える一杯で、今日をやさしく締めくくりましょう。"],
      suggestion: pick(2 + suggestionCount),
      followup_question: null,
      end: true,
      closing: "今日はこのあたりでおすすめは以上です。気になるお茶があれば、じっくり選んでくださいね。",
    };
  }

  return {
    assistant_messages: ["よくわかります。まずは試しやすい一杯から。"],
    suggestion: pick(suggestionCount),
    followup_question:
      suggestionCount === 0
        ? "夜の過ごし方はどんな感じですか？寝る前にも飲みたい？"
        : "日中の集中や作業の前後にも合うお茶を探しますか？",
    end: false,
    closing: null,
  };
}
