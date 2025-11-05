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
    let matches: Array<{ id: string; title: string; content: string }> = [];
    let searchError: string | null = null;
    
    try {
      const { data, error } = await supabase.rpc("match_tea_articles", {
        query_embedding: embedding.data[0].embedding,
        match_threshold: 0.75,
        match_count: 3,
      });
      
      if (error) {
        console.error('❌ RPC error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        searchError = `RPC error: ${error.message}${error.hint ? ` (${error.hint})` : ''}`;
        // フォールバック: tea_articlesテーブルから直接取得を試行
        try {
          const { data: allArticles, error: tableError } = await supabase
            .from('tea_articles')
            .select('id, title, content')
            .limit(3);
          
          if (tableError) {
            console.error('Table query error:', tableError);
            searchError = `Table error: ${tableError.message}`;
          } else {
            matches = allArticles || [];
            console.log(`Fallback: Found ${matches.length} articles from tea_articles table`);
          }
        } catch (fallbackError) {
          console.error('Fallback failed:', fallbackError);
          searchError = `Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`;
        }
      } else {
        matches = data || [];
        console.log(`✅ RAG search successful: Found ${matches.length} articles via match_tea_articles RPC`);
        if (matches.length > 0) {
          console.log('📄 Found articles:', matches.map(m => m.title));
        }
      }
    } catch (rpcError) {
      console.error('RPC call failed:', rpcError);
      searchError = `RPC call failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`;
      // フォールバックを試行
      try {
        const { data: allArticles, error: tableError } = await supabase
          .from('tea_articles')
          .select('id, title, content')
          .limit(3);
        
        if (!tableError && allArticles) {
          matches = allArticles;
          console.log(`Fallback: Found ${matches.length} articles from tea_articles table`);
        }
      } catch (_fallbackError) {
        // フォールバックも失敗した場合は空配列のまま
      }
    }
    
    const prompt = `
あなたは茶ソムリエです。以下のユーザーの回答と参考記事を基に、最適なお茶を自然な文章で提案してください。

ユーザーの回答:
${JSON.stringify(answers, null, 2)}

参考記事:
${matches.length > 0 
  ? matches.map((m: { title: string; content: string }) => `- ${m.title}: ${m.content.slice(0, 200)}...`).join("\n")
  : "（関連記事が見つかりませんでした）"}

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
    
    // レスポンスにエラー情報を含める（開発環境でのデバッグ用）
    const responseData: {
      aiRecommendation: string;
      condition: string;
      matches: number;
      articles?: Array<{ id: string; title: string; excerpt: string }>;
      debug?: {
        searchError?: string | null;
        hasArticles: boolean;
      };
    } = {
      aiRecommendation: responseText,
      condition: userCondition,
      matches: matches.length,
      articles: matches.map((m: { id: string; title: string; content: string }) => ({
        id: m.id,
        title: m.title,
        excerpt: m.content.slice(0, 100) + "...",
      })),
    };
    
    // デバッグ情報を常に含める（エラーがある場合、または本番環境でも確認できるように）
    responseData.debug = {
      searchError: searchError || null,
      hasArticles: matches.length > 0,
      rpcUsed: !searchError || searchError.includes('Fallback'), // RPCが使われたかどうか
    };
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in quick-diagnosis API:', error);
    return NextResponse.json(
      { error: '診断中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

