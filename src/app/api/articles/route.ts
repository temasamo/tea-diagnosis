import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledgeBase } from '@/lib/supabase-knowledge-base';

export async function GET(_request: NextRequest) {
  try {
    // 記事一覧を取得
    const articles = await supabaseKnowledgeBase.getAllArticles();
    console.log(`📚 記事取得: ${articles.length}件の記事を取得しました`);
    
    return NextResponse.json({
      articles,
      count: articles.length
    });
    
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: '記事の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
