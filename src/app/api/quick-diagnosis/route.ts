import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { answers } = await request.json();

    // ユーザーの回答を文字列に変換
    const userCondition = Object.values(answers).join(' ');

    // 1️⃣ ユーザー入力をベクトル化
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userCondition,
    });

    // 2️⃣ 類似記事を検索（RPC）
    const { data: matches } = await supabase.rpc("match_tea_articles", {
      query_embedding: embedding.data[0].embedding,
      match_threshold: 0.75,
      match_count: 3,
    });
    
    const prompt = `
あなたは茶ソムリエです。以下のユーザーの回答と参考記事を基に、最適なお茶を自然な文章で提案してください。

ユーザーの回答:
${JSON.stringify(answers, null, 2)}

参考記事:
${matches?.map((m: any) => `- ${m.title}: ${m.content.slice(0, 200)}...`).join("\n")}

以下の点を含めて自然な文章で回答してください：
- おすすめのお茶の種類とブレンド
- 甘味料の提案
- お茶菓子の提案
- なぜこの組み合わせが良いかの理由

回答は日本語で、実用的で具体的な提案を自然な文章形式で行ってください。
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
    
    return NextResponse.json({ 
      aiRecommendation: responseText,
      condition: userCondition,
      matches: matches?.length || 0
    });

  } catch (error) {
    console.error('Error in quick-diagnosis API:', error);
    return NextResponse.json(
      { error: '診断中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

