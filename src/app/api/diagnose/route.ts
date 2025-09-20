import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatHistory = { role: "assistant" | "user"; text: string };

export async function POST(request: NextRequest) {
  try {
    const { text, suggestionCount, history, askedFollowups, lowEnergyHint } = await request.json();

    const sys = [
      "あなたは日本語で応答する『茶ソムリエAI』です。",
      "会話を通じてお茶を提案し、お茶関連の話題で会話を続けます。",
      "",
      "★最重要：ユーザーのコメントにきちんと反応する：",
      "  1) ユーザーの発言を必ず理解し、共感・受け止めを最初に行う",
      "  2) ユーザーの回答に対してワンテンポ遅れずに適切に反応する",
      "  3) 同じお茶は絶対に重複提案しない（ルイボス→ハイビスカス→ジャスミンなど異なるお茶を提案）",
      "  4) 会話履歴を確認し、既に聞いた質問は避ける",
      "  5) 質問ループを防ぐため、会話履歴を必ず確認してから次の質問を決める",
      "",
      "★自然な日本語表現：",
      "  - 「そんな時には」ではなく「そんな方には」「そのような方には」を使用",
      "  - 「水が好き」→「水がお好きなんですね」「水派なんですね」",
      "  - 「コーヒーが好き」→「コーヒー派なんですね」「コーヒーがお好きなんですね」",
      "  - 「お酒が好き」→「お酒がお好きなんですね」「お酒派なんですね」",
      "  - 提案時は「そんな方には」「そのような方には」「そのような嗜好の方には」を使用",
      "  - 自然で親しみやすい敬語を使用",
      "",
      "★重複質問防止（最重要）：",
      "  - フォローアップ質問は askedFollowups に含まれる過去質問と「意味的に重複しない」こと",
      "  - 重複しそうなら別軸（温冷/カフェイン/香り/シーン/甘さ/和洋など）で1つだけ聞くこと",
      "  - 直前と異なる軸で質問すること",
      "  - ユーザーが「もう大丈夫」「最後と言った」など終了意図を示したら、即 end=true とし、丁寧に締めること",
      "",
      "★低エネルギー対応：",
      "  - lowEnergyHint が true のときは、語尾をやわらかく、まずは負担の少ないお茶（カフェイン控えめ等）を優先すること",
      "  - しんどい時には「まずはやさしい一杯から」のような表現を使用",
      "  - カフェインフリーやハーブティーを優先提案",
      "",
      "★会話継続ルール：",
      "  - 3回提案後も、お茶関連の話題が続く限り会話を継続する",
      "  - 5回提案後は「お時間大丈夫ですか？」と時間確認をする",
      "  - 時間確認後は、お茶だけでなくお茶関連商品（茶器、茶葉、お菓子など）も提案する",
      "  - ユーザーが終了意図を示すまで会話を続ける",
      "",
      "各ターンでは次を厳守：",
      "  (a) assistant_messages：ユーザーの発言に対する共感・理解を最初に表現",
      "  (b) suggestion：{name, reason} でお茶またはお茶関連商品を1つだけ提案（重複厳禁）",
      "  (c) followup_question：次の掘り下げ質問を1つだけ（前回質問と重複厳禁）",
      "  (d) time_check：5回提案後は true にして時間確認を行う",
      "",
      "お茶の種類例：",
      "  一般的：煎茶、ほうじ茶、麦茶、ウーロン茶、紅茶",
      "  変わった：ルイボス、ハイビスカス、ジャスミン、カモミール、ローズヒップ、抹茶、プーアル茶",
      "  高級：白毫銀針、大吉嶺、アールグレイ、ダージリン",
      "",
      "お茶関連商品例：",
      "  茶器：急須、湯呑み、茶碗、茶筒、茶こし",
      "  茶葉：高級茶葉、ブレンド茶、季節限定茶",
      "  お菓子：和菓子、洋菓子、茶菓子、クッキー",
      "  その他：茶道具、茶葉保存容器、茶葉ギフト",
      "",
      "出力は strict JSON のみ：",
      '{ "assistant_messages": string[], "suggestion": { "name": string, "reason": string } | null, "followup_question": string | null, "end": boolean, "closing": string | null, "time_check": boolean }'
    ].join("\n");

    const user = [
      `現在の提案回数: ${suggestionCount}/∞`,
      `ユーザー入力: """${text.trim()}"""`,
      `askedFollowups: ${JSON.stringify(askedFollowups ?? [])}`,
      `lowEnergyHint: ${Boolean(lowEnergyHint)}`,
      "",
      "★最重要：ユーザーのコメントにきちんと反応する：",
      "- ユーザーの発言を必ず理解し、共感・受け止めを最初に行う",
      "- ユーザーの回答に対してワンテンポ遅れずに適切に反応する",
      "- 同じお茶は絶対に重複提案しない",
      "- 会話履歴を確認し、既に提案したお茶は重複しない",
      "- 質問の順序：気分→温度→味→種類→時間帯/シーン",
      "- 会話履歴を必ず確認し、同じ質問を繰り返さない",
      "",
      "★自然な日本語表現：",
      "- 「そんな時には」ではなく「そんな方には」「そのような方には」を使用",
      "- ユーザーの嗜好に応じて自然な敬語で反応",
      "- 提案時は「そんな方には」「そのような方には」を使用",
      "",
      "★重複質問防止（最重要）：",
      "- askedFollowups に含まれる過去質問と意味的に重複しない質問を出す",
      "- 直前と異なる軸（温冷/カフェイン/香り/シーン/甘さ/和洋）で質問する",
      "- ユーザーが終了意図を示したら即 end=true とする",
      "",
      "★会話継続ルール：",
      "- 3回提案後も、お茶関連の話題が続く限り会話を継続する",
      "- 5回提案後は time_check=true にして「お時間大丈夫ですか？」と時間確認をする",
      "- 時間確認後は、お茶だけでなくお茶関連商品も提案する",
      "- ユーザーが終了意図を示すまで会話を続ける",
      "",
      "会話履歴:",
      ...history.slice(-6).map((h: ChatHistory) => `${h.role}: ${h.text}`),
    ].join("\n");

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(mockTurn(suggestionCount, text));
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(mockTurn(suggestionCount, text));
    }
  } catch (error) {
    console.error("API error:", error);
    // suggestionCountとtextをデフォルト値で使用
    return NextResponse.json(mockTurn(0, ""));
  }
}

function mockTurn(suggestionCount: number, userInput: string) {
  const teas = [
    { name: "ルイボスティー", reason: "カフェインフリーでリラックス効果があります" },
    { name: "ハイビスカスティー", reason: "酸味がさわやかで疲労回復に効果的です" },
    { name: "ジャスミンティー", reason: "香りが高く、気分をリフレッシュしてくれます" },
    { name: "カモミールティー", reason: "やさしい香りで心を落ち着かせてくれます" },
    { name: "ローズヒップティー", reason: "ビタミンCが豊富で美容にも良いです" },
    { name: "抹茶", reason: "集中力を高め、リラックス効果もあります" },
    { name: "プーアル茶", reason: "独特の香りでリラックス効果があります" },
    { name: "煎茶", reason: "すっきりとした味わいで気分転換に最適です" },
    { name: "ほうじ茶", reason: "香ばしい香りで心を落ち着かせてくれます" },
    { name: "麦茶", reason: "カフェインフリーで体にやさしいです" }
  ];

  const teaProducts = [
    { name: "急須", reason: "お茶の香りと味を最大限に引き出してくれます" },
    { name: "茶筒", reason: "茶葉の鮮度を保つ保存容器です" },
    { name: "和菓子", reason: "お茶と一緒にいただくと格別です" },
    { name: "茶こし", reason: "茶葉をこすのに便利な道具です" },
    { name: "湯呑み", reason: "お茶の香りを楽しめる器です" }
  ];

  let selectedItem;
  let isTeaProduct = false;
  
  if (suggestionCount < 5) {
    selectedItem = teas[suggestionCount % teas.length];
  } else {
    selectedItem = teaProducts[suggestionCount % teaProducts.length];
    isTeaProduct = true;
  }
  
  const questions = [
    "温かいお茶と冷たいお茶、どちらがお好みですか？",
    "カフェインの有無は気になりますか？",
    "香りの強いお茶と控えめなお茶、どちらがお好みですか？",
    "甘いお茶とすっきりしたお茶、どちらがお好みですか？",
    "お茶を淹れる時間はありますか？",
    "お茶と一緒に何かお菓子はいかがですか？"
  ];

  return {
    assistant_messages: ["なるほど、そうですね。"],
    suggestion: selectedItem,
    followup_question: questions[suggestionCount % questions.length],
    end: false,
    closing: null,
    time_check: suggestionCount === 4
  };
}
