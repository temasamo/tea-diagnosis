// src/app/api/diagnose/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "edge"; // 速い＆安い（Nodeが必要なら削除）

type ReqBody = { text?: string };

export async function POST(req: Request) {
  try {
    const { text }: ReqBody = await req.json();
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { message: "お悩みを1〜2行で教えてください。例：最近眠れないのでリラックスできるお茶が欲しい" },
        { status: 400 },
      );
    }

    // 1) OpenAIキーがない/使えない場合はモックで即応答
    if (!openai) {
      const mock = mockReply(text);
      return NextResponse.json({ message: mock, source: "mock" });
    }

    // 2) 生成AIで「茶ソムリエ風コメント」を生成（短文・優しめ）
    const prompt = [
      {
        role: "system",
        content:
          "あなたは知識豊富で優しい『茶ソムリエ』。ユーザーの悩みを受けて、健康効果は断定せず一般的な範囲で、1〜2文のやさしい日本語でおすすめのお茶カテゴリを提案してください。最後に（例：おすすめ：カモミール、ルイボス など）と簡潔に添えてください。",
      },
      {
        role: "user",
        content: `ユーザーの悩み: 「${text}」\n制約: 医療助言や効果断定は避け、一般的な表現のみ。`,
      },
    ] as const;

    // Chat Completions（簡単に使える形）
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: prompt as any,
      temperature: 0.7,
      max_tokens: 180,
    });

    const message =
      completion.choices?.[0]?.message?.content?.trim() ??
      mockReply(text); // 念のためモックにフォールバック

    return NextResponse.json({ message, source: "openai" });
  } catch (err) {
    // 失敗時はモックで返してUIを止めない
    const mock = mockReply("リラックスしたい");
    return NextResponse.json({ message: mock, source: "mock-fallback" });
  }
}

/** 超簡易モック（キー無しや障害時に使用） */
function mockReply(text: string) {
  const t = text.toLowerCase();
  if (t.includes("眠") || t.includes("寝") || t.includes("快眠")) {
    return "一日お疲れさま。やさしく心を落ち着けたいときは、ノンカフェインのカモミールやルイボスがおすすめです。\n（おすすめ：カモミール、ルイボス）";
  }
  if (t.includes("集中") || t.includes("仕事") || t.includes("勉強")) {
    return "シャキッとしたいなら、適度なカフェインとテアニンの煎茶や、短時間のブーストに抹茶がぴったりです。\n（おすすめ：煎茶、抹茶）";
  }
  if (t.includes("デトックス") || t.includes("すっきり") || t.includes("むくみ")) {
    return "すっきり整えたい日は、レモングラスやはと麦、とうもろこしひげ茶などのブレンドをどうぞ。\n（おすすめ：レモングラスブレンド、はと麦茶）";
  }
  if (t.includes("ダイエット") || t.includes("脂") || t.includes("食事")) {
    return "食事と一緒に楽しむなら、すっきり飲みやすいウーロンやプーアルがおすすめです。\n（おすすめ：ウーロン茶、プーアル茶）";
  }
  return "その気分、よくわかります。まずは飲みやすいほうじ茶や、気分転換にペパーミントをどうぞ。\n（おすすめ：ほうじ茶、ペパーミント）";
}
