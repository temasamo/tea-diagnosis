import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBase, ArticleData } from '@/lib/knowledge-base';

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json();

    if (!articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { error: '記事データが正しくありません' },
        { status: 400 }
      );
    }

    // 各記事から知識を抽出
    const allKnowledgeEntries = [];
    
    for (const article of articles) {
      console.log(`Processing article: ${article.title}`);
      
      try {
        const knowledgeEntries = await knowledgeBase.extractKnowledgeFromArticle(article);
        allKnowledgeEntries.push(...knowledgeEntries);
        console.log(`Extracted ${knowledgeEntries.length} knowledge entries from: ${article.title}`);
      } catch (error) {
        console.error(`Error processing article ${article.title}:`, error);
        // 個別記事のエラーは無視して続行
      }
    }
    
    // 知識ベースに追加
    knowledgeBase.addKnowledge(allKnowledgeEntries);
    
    return NextResponse.json({
      message: '記事の学習が完了しました',
      articlesCount: articles.length,
      knowledgeEntriesCount: allKnowledgeEntries.length,
      lastUpdate: knowledgeBase.getLastUpdate()?.toISOString(),
      sampleEntries: allKnowledgeEntries.slice(0, 5) // 最初の5件をサンプルとして返す
    });
    
  } catch (error) {
    console.error('Error in upload-articles API:', error);
    return NextResponse.json(
      { error: '記事の学習中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allKnowledge = knowledgeBase.getAllKnowledge();
    const lastUpdate = knowledgeBase.getLastUpdate();
    
    return NextResponse.json({
      knowledgeEntriesCount: allKnowledge.length,
      lastUpdate: lastUpdate?.toISOString(),
      sampleEntries: allKnowledge.slice(0, 10), // 最初の10件をサンプルとして返す
      allEntries: allKnowledge // 全エントリを返す
    });
  } catch (error) {
    console.error('Error getting knowledge status:', error);
    return NextResponse.json(
      { error: '知識ベースの取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

