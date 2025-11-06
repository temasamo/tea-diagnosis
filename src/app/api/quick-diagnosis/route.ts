import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// RAG検索のためにサービスロールキーを使用（RLSをバイパス）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  console.log('🚀 /api/quick-diagnosis リクエスト受信');
  try {
    const { answers } = await request.json();
    console.log('📝 ユーザー回答受信:', { answersCount: Object.keys(answers).length });

    // ユーザーの回答を文字列に変換（ログ用）
    const rawAnswers = Object.values(answers).join(' ');
    console.log('📄 ユーザー回答（連結）:', rawAnswers);

    // 1️⃣ 選択結果から自然文の診断文を生成
    console.log('📝 診断文生成開始...');
    const diagnosisPrompt = `
以下のユーザーの質問と回答から、自然な日本語で診断文を生成してください。

質問と回答:
${JSON.stringify(answers, null, 2)}

診断文の例:
- 「あなたは疲労気味で、目の疲れも感じており、リラックスしたい気分です」
- 「疲れている状態で、胃の調子を気にされており、集中力を高めたいと考えています」

診断文は、ユーザーの状態や希望を自然な文章で表現してください。簡潔で具体的な表現にしてください。
`;

    const diagnosisResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "あなたは茶ソムリエです。ユーザーの質問と回答から、自然な日本語で診断文を生成してください。"
        },
        {
          role: "user",
          content: diagnosisPrompt
        }
      ],
      temperature: 0.3,
    });

    const userCondition = diagnosisResponse.choices[0]?.message?.content?.trim() || rawAnswers;
    console.log('✅ 診断文生成完了:', userCondition);

    // 2️⃣ 診断文をベクトル化
    console.log('🔢 Embedding生成開始...');
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userCondition,
    });
    console.log('✅ Embedding生成完了:', { dimension: embedding.data[0].embedding.length });

    // 3️⃣ 類似記事を検索（RPC）
    let matches: Array<{ id: string; title: string; content: string }> = [];
    let searchError: string | null = null;
    
    try {
      const { data, error } = await supabase.rpc("match_tea_articles", {
        query_embedding: embedding.data[0].embedding,
        match_threshold: 0.4, // 0.6から0.4に下げて、より多くの記事を検索できるように
        match_count: 5, // 3から5に増やして、より多くの候補を取得
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
あなたは茶ソムリエです。以下のユーザーの診断文と参考記事を基に、最適なお茶を自然な文章で提案してください。

ユーザーの診断文:
${userCondition}

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
        rpcUsed?: boolean;
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
    
    console.log('📤 レスポンス送信:', {
      matches: responseData.matches,
      articlesCount: responseData.articles?.length || 0,
      hasDebug: !!responseData.debug,
      searchError: responseData.debug.searchError
    });
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ /api/quick-diagnosis エラー:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    return NextResponse.json(
      { 
        error: '診断中にエラーが発生しました',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    );
  }
}

