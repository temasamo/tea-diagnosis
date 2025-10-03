import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { knowledgeBase } from '@/lib/knowledge-base';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { answers } = await request.json();

    // 動的知識ベースから関連する提案を取得
    const relevantKnowledge = getRelevantKnowledge(answers);
    
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

// ユーザーの回答に基づいて関連する知識を取得
function getRelevantKnowledge(answers: Record<string, string>): string {
  const allKnowledge = knowledgeBase.getAllKnowledge();
  
  // ユーザーの回答からキーワードを抽出
  const keywords = Object.values(answers).join(' ');
  
  // 関連する知識を検索
  const relevantEntries = allKnowledge.filter(entry => {
    const entryText = `${entry.condition} ${entry.tea} ${entry.blend} ${entry.sweetener} ${entry.snack}`.toLowerCase();
    const keywordText = keywords.toLowerCase();
    
    // キーワードマッチング
    return entryText.includes(keywordText) || 
           keywordText.includes(entry.condition.toLowerCase()) ||
           entry.condition.toLowerCase().includes(keywordText);
  });
  
  // 関連する知識を文字列として返す
  if (relevantEntries.length > 0) {
    return relevantEntries.map(entry => 
      `条件: ${entry.condition}\nお茶: ${entry.tea}\nブレンド: ${entry.blend}\n甘味料: ${entry.sweetener}\nお茶菓子: ${entry.snack}\n理由: ${entry.reason}\n出典: ${entry.source}`
    ).join('\n\n');
  }
  
  // 関連する知識がない場合は、全知識からランダムに選択
  const randomEntries = allKnowledge.slice(0, 3);
  return randomEntries.map(entry => 
    `条件: ${entry.condition}\nお茶: ${entry.tea}\nブレンド: ${entry.blend}\n甘味料: ${entry.sweetener}\nお茶菓子: ${entry.snack}\n理由: ${entry.reason}\n出典: ${entry.source}`
  ).join('\n\n');
}
