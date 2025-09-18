import { NextRequest, NextResponse } from "next/server";

type ChatHistory = { role: string; text: string };

export async function POST(request: NextRequest) {
  try {
    const { text, suggestionCount = 0, history = [] } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // OpenAI API Key がない場合はモックを返す
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(mockTurn(text, suggestionCount));
    }

    // OpenAI API Key がある場合の処理
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const sys = [
      "あなたは日本語で応答する『茶ソムリエAI』です。",
      "会話を通じて合計3回まで、毎回1つだけお茶を提案します。",
      "★重要：ユーザーが『お茶以外』(例: コーヒー/水/炭酸/エナジードリンク/お酒 など) を答えた場合でも、",
      "  1) まず共感して受け止める（例：『コーヒー派なんですね！』）",
      "  2) その飲み物の嗜好（温/冷、甘/さっぱり、カフェイン可否、香りの好み など）を1つだけ質問で深掘りする",
      "  3) その嗜好に\"自然に橋渡しできる\"お茶を1つだけ提案する（例：コーヒー派→焙煎香の強い『ほうじ茶』等）",
      "  4) 無反応や話題無視は禁止。必ず会話を継続する。",
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

    const user = [
      `現在の提案回数: ${suggestionCount}/3`,
      `ユーザー入力: ${text}`,
      "",
      "★重要：ユーザーが「どちらも」「両方」「どっちも」と答えた場合は、",
      "「どちらもお好きなんですね」のように受け止めて、その嗜好に合うお茶を提案してください。",
      "「温かいが好き」などと誤解釈しないでください。",
      "",
      "会話履歴:",
      ...history.slice(-4).map((h: ChatHistory) => `${h.role}: ${h.text}`),
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json(mockTurn(text, suggestionCount));

    let parsed: Record<string, unknown>;
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
  } catch (error) {
    return NextResponse.json(mockTurn("エラー", 0));
  }
}

// ── 超簡易モック（OpenAI未設定/失敗時用） ─────────────────────
function mockTurn(text: string, suggestionCount: number) {
  const bank = [
    { name: "煎茶", reason: "程よいカフェインで集中力が高まります" },
    { name: "ほうじ茶", reason: "香ばしい香りでリラックスできます" },
    { name: "ルイボスティー", reason: "カフェインフリーで体に優しいです" },
    { name: "カモミール", reason: "心を落ち着かせる効果があります" },
    { name: "ジャスミンティー", reason: "花の香りで気分が明るくなります" },
  ];

  const n = Math.min(suggestionCount + 1, 3);
  const selected = bank[suggestionCount % bank.length];

  if (n >= 3) {
    return {
      assistant_messages: ["最後の提案です。"],
      suggestion: selected,
      followup_question: null,
      end: true,
      closing: "今日はこのあたりでおすすめは以上です。お疲れさまでした！",
    };
  }

  return {
    assistant_messages: ["なるほど、そうですね。"],
    suggestion: selected,
    followup_question: "他に気になるお茶はありますか？",
    end: false,
    closing: null,
  };
}
