import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseKnowledgeBase } from '@/lib/supabase-knowledge-base';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { answers } = await request.json();

      // Supabaseから関連する提案を取得
      const relevantKnowledge = await supabaseKnowledgeBase.getRelevantKnowledge(answers);
    
    const prompt = `
あなたは茶ソムリエです。以下のユーザーの回答とHealTeaの知識ベースを基に、最適なお茶・甘味料・お茶菓子を提案してください。

ユーザーの回答:
${JSON.stringify(answers, null, 2)}

関連する知識ベース:
${relevantKnowledge}

以下の形式で回答してください:
{
  "tea": "具体的なお茶の種類とブレンド",
  "sweetener": "おすすめの甘味料",
  "snack": "おすすめのお茶菓子",
  "reason": "なぜこの組み合わせが良いかの理由（2-3文）"
}

回答は日本語で、実用的で具体的な提案をしてください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは茶ソムリエです。ユーザーの体調や気分に合わせて最適なお茶・甘味料・お茶菓子を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    try {
      const recommendation = JSON.parse(responseText);
      return NextResponse.json({ recommendation });
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // フォールバック提案
      const fallbackRecommendation = {
        tea: "緑茶 + はちみつ + レモン",
        sweetener: "はちみつ",
        snack: "和菓子（ようかん）",
        reason: "疲労回復とリラックス効果が期待できる組み合わせです。"
      };
      return NextResponse.json({ recommendation: fallbackRecommendation });
    }

  } catch (error) {
    console.error('Error in quick-diagnosis API:', error);
    return NextResponse.json(
      { error: '診断中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

