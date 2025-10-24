import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledgeBase } from '@/lib/supabase-knowledge-base';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    
    // 記事詳細を取得
    const article = await supabaseKnowledgeBase.getArticleById(articleId);
    
    if (!article) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }
    
    // その記事から抽出された知識を取得
    const knowledgeEntries = await supabaseKnowledgeBase.getKnowledgeBySource(article.title);
    
    return NextResponse.json({
      article,
      knowledgeEntries,
      knowledgeCount: knowledgeEntries.length
    });
    
  } catch (error) {
    console.error('Error fetching article details:', error);
    return NextResponse.json(
      { error: '記事詳細の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
