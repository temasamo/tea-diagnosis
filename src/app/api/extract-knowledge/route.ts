import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { title, content, category, tags } = await request.json();

    const prompt = `
あなたは茶ソムリエの専門家です。以下の記事から、お茶の提案に活用できる知識を抽出してください。

記事タイトル: ${title}
記事カテゴリ: ${category}
記事タグ: ${tags.join(', ')}

記事内容:
${content}

以下の形式で、この記事から抽出できる知識エントリを生成してください。複数の条件や提案がある場合は、それぞれを別々のエントリとして作成してください。

回答形式（JSON配列）:
[
  {
    "condition": "対象となる症状・状況（例：疲労、目の疲れ、免疫力低下など）",
    "tea": "おすすめのお茶の種類",
    "blend": "ブレンド素材（ハーブ、フルーツなど）",
    "sweetener": "おすすめの甘味料",
    "snack": "おすすめのお茶菓子",
    "reason": "なぜこの組み合わせが良いかの理由"
  }
]

注意事項:
- 記事に明記されていない推測は避け、記事の内容に基づいた提案のみを抽出してください
- 条件は具体的で分かりやすい表現にしてください
- お茶の種類は具体的に（例：「緑茶」「紅茶」「プーアル茶」など）
- ブレンド素材は記事で言及されているもののみ
- 甘味料とお茶菓子は記事で推奨されているもの、または一般的に相性の良いものを提案
- 理由は記事の内容に基づいて簡潔に説明

記事から知識を抽出できない場合は、空の配列 [] を返してください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは茶ソムリエの専門家です。記事からお茶の提案に活用できる知識を正確に抽出してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3, // 低い温度で一貫性のある抽出
    });

    const responseText = completion.choices[0]?.message?.content || '[]';
    
    try {
      const knowledgeEntries = JSON.parse(responseText);
      
      // バリデーション
      if (!Array.isArray(knowledgeEntries)) {
        throw new Error('Invalid response format');
      }
      
      // 各エントリの必須フィールドをチェック
      const validEntries = knowledgeEntries.filter(entry => 
        entry.condition && 
        entry.tea && 
        entry.sweetener && 
        entry.snack && 
        entry.reason
      );
      
      return NextResponse.json({ 
        knowledgeEntries: validEntries,
        extractedCount: validEntries.length,
        totalCount: knowledgeEntries.length
      });
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text:', responseText);
      
      // フォールバック: 空の配列を返す
      return NextResponse.json({ 
        knowledgeEntries: [],
        extractedCount: 0,
        totalCount: 0,
        error: 'Failed to parse AI response'
      });
    }

  } catch (error) {
    console.error('Error in extract-knowledge API:', error);
    return NextResponse.json(
      { 
        error: '知識抽出中にエラーが発生しました',
        knowledgeEntries: [],
        extractedCount: 0,
        totalCount: 0
      },
      { status: 500 }
    );
  }
}

