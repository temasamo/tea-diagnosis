import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledgeBase } from '@/lib/supabase-knowledge-base';
// import { ArticleData } from '@/lib/knowledge-base';

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json();

    if (!articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { error: '記事データが正しくありません' },
        { status: 400 }
      );
    }

    // 各記事から知識を抽出してSupabaseに保存
    const allKnowledgeEntries = [];
    
    for (const article of articles) {
      console.log(`=== Processing article: ${article.title} ===`);
      
      try {
        console.log('Calling extractAndSaveKnowledge...');
        const knowledgeEntries = await supabaseKnowledgeBase.extractAndSaveKnowledge(article);
        console.log(`Knowledge entries returned: ${knowledgeEntries.length}`);
        allKnowledgeEntries.push(...knowledgeEntries);
        console.log(`Extracted ${knowledgeEntries.length} knowledge entries from: ${article.title}`);
      } catch (error: unknown) {
        console.error(`Error processing article ${article.title}:`, error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
          console.error('Error stack:', error.stack);
        }
        // 個別記事のエラーは無視して続行
      }
    }
    
    // 統計情報を取得
    const stats = await supabaseKnowledgeBase.getStats();
    
    return NextResponse.json({
      message: '記事の学習が完了しました（Supabase保存）',
      articlesCount: articles.length,
      knowledgeEntriesCount: allKnowledgeEntries.length,
      stats,
      sampleEntries: allKnowledgeEntries.slice(0, 5) // 最初の5件をサンプルとして返す
    });
    
  } catch (error: unknown) {
    console.error('Error in supabase-upload API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `記事の学習中にエラーが発生しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await supabaseKnowledgeBase.getStats();
    const allKnowledge = await supabaseKnowledgeBase.getAllKnowledge();
    
    return NextResponse.json({
      ...stats,
      sampleEntries: allKnowledge.slice(0, 5),
      allEntries: allKnowledge
    });
    
  } catch (error: unknown) {
    console.error('Error fetching Supabase data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `データの取得中にエラーが発生しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}
