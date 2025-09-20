import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatHistory = { role: "assistant" | "user"; text: string };

export async function POST(request: NextRequest) {
  try {
    const { text, suggestionCount, history, askedFollowups, lowEnergyHint, diagnosisPhase, userProfile } = await request.json();

    const sys = [
      "あなたは日本語で応答する『茶ソムリエAI』です。",
      "効率的な診断を通じて、ユーザーに最適なお茶とその飲み方を提案します。",
      "",
      "★診断ルール（最重要）：",
      "  1) 質問回数が3回に達したら必ずお茶を提案する",
      "  2) 質問は具体的で分かりやすくする",
      "  3) 同じ質問は絶対に重複しない",
      "  4) suggestionCountが3以上なら必ずsuggestionを返す",
      "",
      "★具体的な質問例：",
      "  - 「疲れている」→「どの時間帯に疲れを感じますか？（朝・昼・夜）」",
      "  - 「ストレス」→「仕事のストレスですか？それとも人間関係ですか？」",
      "  - 「冷え性」→「手足の冷えですか？それともお腹の冷えですか？」",
      "  - 「睡眠」→「寝つきが悪いですか？それとも途中で目が覚めますか？」",
      "  - 「胃の調子」→「食後ですか？空腹時ですか？」",
      "",
      "★提案内容：",
      "  - お茶の種類と理由",
      "  - 最適な飲み方（温度、時間、量など）",
      "  - 合う甘味料（蜂蜜、砂糖、黒砂糖、メープルシロップなど）",
      "  - 合う食べ物（和菓子、洋菓子、フルーツ、ナッツなど）",
      "  - 効果的なタイミング",
      "",
      "★自然な日本語表現：",
      "  - 「そんな時には」ではなく「そんな方には」「そのような方には」を使用",
      "  - ユーザーの状況に共感し、親しみやすい敬語を使用",
      "",
      "各ターンでは次を厳守：",
      "  (a) assistant_messages：ユーザーの発言に対する共感・理解を最初に表現",
      "  (b) diagnosis_question：具体的で分かりやすい質問を1つだけ（重複厳禁）",
      "  (c) suggestion：suggestionCountが3以上なら必ずお茶を提案",
      "  (d) phase：現在のフェーズ（collecting/suggesting/confirming）",
      "",
      "★重要：JSON形式で必ず応答すること。他の文字は一切含めない。",
      "",
      "出力は strict JSON のみ：",
      '{ "assistant_messages": string[], "diagnosis_question": string | null, "suggestion": { "tea": string, "reason": string, "brewing": string, "sweetener": string, "food": string, "timing": string } | null, "phase": string }'
    ].join("\n");

    const user = [
      `現在のフェーズ: ${diagnosisPhase || "collecting"}`,
      `質問回数: ${suggestionCount}`,
      `ユーザー入力: """${text.trim()}"""`,
      `askedFollowups: ${JSON.stringify(askedFollowups ?? [])}`,
      `lowEnergyHint: ${Boolean(lowEnergyHint)}`,
      `ユーザープロフィール: ${JSON.stringify(userProfile || {})}`,
      "",
      "★重要ルール：",
      `- 質問回数が${suggestionCount}回で、3回以上なら必ずお茶を提案する`,
      "- 質問は具体的で分かりやすくする",
      "- 同じ質問は絶対に重複しない",
      "- ユーザーの発言を必ず理解し、共感・受け止めを最初に行う",
      "- JSON形式で必ず応答すること",
      "",
      "会話履歴:",
      ...history.slice(-6).map((h: ChatHistory) => `${h.role}: ${h.text}`),
    ].join("\n");

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(mockTurn(suggestionCount, text, diagnosisPhase, userProfile));
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // JSONの前後に余分な文字がある場合の処理
    let cleanContent = content.trim();
    
    // JSONの開始位置を探す
    const jsonStart = cleanContent.indexOf('{');
    const jsonEnd = cleanContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
    }

    try {
      const parsed = JSON.parse(cleanContent);
      
      // suggestionCountが3以上なら強制的にお茶を提案
      if (suggestionCount >= 3 && !parsed.suggestion) {
        const teaSuggestions = [
          {
            tea: "ルイボスティー",
            reason: "カフェインフリーでリラックス効果があり、胃に優しいです",
            brewing: "95度のお湯で3-5分蒸らす",
            sweetener: "蜂蜜（温かいうちに少量）",
            food: "アーモンドやクルミなどのナッツ",
            timing: "夕方から夜にかけて"
          },
          {
            tea: "ジャスミンティー",
            reason: "香りが高く、気分をリフレッシュしてくれます",
            brewing: "80度のお湯で2-3分蒸らす",
            sweetener: "砂糖（香りを邪魔しない程度）",
            food: "和菓子や軽いクッキー",
            timing: "午後のリラックスタイム"
          },
          {
            tea: "抹茶",
            reason: "集中力を高め、リラックス効果もあります",
            brewing: "70度のお湯で茶筅でよくかき混ぜる",
            sweetener: "黒砂糖（抹茶の苦味と相性抜群）",
            food: "和菓子、特に生菓子",
            timing: "朝の集中したい時間"
          },
          {
            tea: "生姜茶",
            reason: "体を温め、胃腸の調子を整えてくれます",
            brewing: "90度のお湯で3分蒸らす",
            sweetener: "黒砂糖（生姜の辛味と相性抜群）",
            food: "温かいお粥や軽いスープ",
            timing: "朝食時や体が冷えた時"
          }
        ];
        
        const selectedTea = teaSuggestions[suggestionCount % teaSuggestions.length];
        parsed.suggestion = selectedTea;
        parsed.diagnosis_question = null;
        parsed.phase = "suggesting";
        parsed.assistant_messages = ["情報を整理して、最適なお茶をご提案させていただきますね。"];
      }
      
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", content);
      console.error("Clean content:", cleanContent);
      return NextResponse.json(mockTurn(suggestionCount, text, diagnosisPhase, userProfile));
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(mockTurn(0, "", "collecting", {}));
  }
}

function mockTurn(suggestionCount: number, userInput: string, phase: string, userProfile: any) {
  const diagnosisQuestions = [
    "どの時間帯に疲れを感じますか？（朝・昼・夜）",
    "手足の冷えですか？それともお腹の冷えですか？",
    "寝つきが悪いですか？それとも途中で目が覚めますか？",
    "食後ですか？それとも空腹時に胃の調子が悪くなりますか？",
    "温かいお茶と冷たいお茶、どちらがお好みですか？",
    "カフェインは気になりますか？（あり・なし・控えめ）"
  ];

  const teaSuggestions = [
    {
      tea: "ルイボスティー",
      reason: "カフェインフリーでリラックス効果があり、胃に優しいです",
      brewing: "95度のお湯で3-5分蒸らす",
      sweetener: "蜂蜜（温かいうちに少量）",
      food: "アーモンドやクルミなどのナッツ",
      timing: "夕方から夜にかけて"
    },
    {
      tea: "ジャスミンティー",
      reason: "香りが高く、気分をリフレッシュしてくれます",
      brewing: "80度のお湯で2-3分蒸らす",
      sweetener: "砂糖（香りを邪魔しない程度）",
      food: "和菓子や軽いクッキー",
      timing: "午後のリラックスタイム"
    },
    {
      tea: "抹茶",
      reason: "集中力を高め、リラックス効果もあります",
      brewing: "70度のお湯で茶筅でよくかき混ぜる",
      sweetener: "黒砂糖（抹茶の苦味と相性抜群）",
      food: "和菓子、特に生菓子",
      timing: "朝の集中したい時間"
    },
    {
      tea: "生姜茶",
      reason: "体を温め、胃腸の調子を整えてくれます",
      brewing: "90度のお湯で3分蒸らす",
      sweetener: "黒砂糖（生姜の辛味と相性抜群）",
      food: "温かいお粥や軽いスープ",
      timing: "朝食時や体が冷えた時"
    }
  ];

  // 3回質問したら必ずお茶を提案
  if (suggestionCount >= 3) {
    const selectedTea = teaSuggestions[suggestionCount % teaSuggestions.length];
    return {
      assistant_messages: ["情報を整理して、最適なお茶をご提案させていただきますね。"],
      diagnosis_question: null,
      suggestion: selectedTea,
      phase: "suggesting"
    };
  }

  // 質問フェーズ
  return {
    assistant_messages: ["なるほど、そうですね。"],
    diagnosis_question: diagnosisQuestions[suggestionCount % diagnosisQuestions.length],
    suggestion: null,
    phase: "collecting"
  };
}
