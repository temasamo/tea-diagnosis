import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBase, ArticleData } from '@/lib/knowledge-base';

// HealTeaサイトから記事を取得する関数
async function fetchHealTeaArticles(): Promise<ArticleData[]> {
  try {
    // 実際のHealTeaサイトから記事を取得
    const response = await fetch('https://www.reset-tea.com/category/health', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TeaDiagnosisBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      // タイムアウト設定
      signal: AbortSignal.timeout(10000) // 10秒でタイムアウト
    });
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      console.error(`Response headers:`, Object.fromEntries(response.headers.entries()));
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`Successfully fetched HTML, length: ${html.length}`);
    
    // HTMLから記事情報を抽出（簡易版）
    const articles: ArticleData[] = [];
    
    // 記事タイトルとリンクを抽出
    const titleMatches = html.match(/<h2[^>]*>([^<]+)<\/h2>/g);
    const linkMatches = html.match(/href="([^"]*\/health\/[^"]*)"/g);
    
    if (titleMatches && linkMatches) {
      for (let i = 0; i < Math.min(titleMatches.length, linkMatches.length); i++) {
        const title = titleMatches[i].replace(/<[^>]*>/g, '').trim();
        const link = linkMatches[i].replace(/href="([^"]*)"/, '$1');
        
        if (title && link) {
          // 個別記事の内容を取得
          try {
            const articleResponse = await fetch(`https://www.reset-tea.com${link}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TeaDiagnosisBot/1.0)'
              }
            });
            
            if (articleResponse.ok) {
              const articleHtml = await articleResponse.text();
              const content = extractArticleContent(articleHtml);
              
              articles.push({
                title,
                content,
                category: 'health',
                tags: extractTags(articleHtml),
                publishDate: extractPublishDate(articleHtml)
              });
            }
          } catch (error) {
            console.error(`Error fetching article ${link}:`, error);
          }
        }
      }
    }
    
    console.log(`Extracted ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('Error fetching HealTea articles:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return [];
  }
}

// 記事の本文を抽出
function extractArticleContent(html: string): string {
  // 記事の本文部分を抽出（簡易版）
  const contentMatch = html.match(/<article[^>]*>(.*?)<\/article>/s);
  if (contentMatch) {
    return contentMatch[1]
      .replace(/<[^>]*>/g, ' ') // HTMLタグを除去
      .replace(/\s+/g, ' ') // 複数の空白を1つに
      .trim();
  }
  return '';
}

// タグを抽出
function extractTags(html: string): string[] {
  const tagMatches = html.match(/<span[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/span>/g);
  if (tagMatches) {
    return tagMatches.map(match => 
      match.replace(/<[^>]*>/g, '').trim()
    );
  }
  return [];
}

// 公開日を抽出
function extractPublishDate(html: string): string {
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
}

// 記事を学習するAPIエンドポイント
export async function POST(request: NextRequest) {
  try {
    const { forceUpdate = false } = await request.json();
    
    // 強制更新でない場合、最近更新されたかチェック
    const lastUpdate = knowledgeBase.getLastUpdate();
    if (!forceUpdate && lastUpdate) {
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) { // 24時間以内に更新済み
        return NextResponse.json({ 
          message: '最近更新済みです',
          lastUpdate: lastUpdate.toISOString()
        });
      }
    }
    
    // HealTeaサイトから記事を取得
    const articles = await fetchHealTeaArticles();
    
    if (articles.length === 0) {
      return NextResponse.json({ 
        error: '記事を取得できませんでした' 
      }, { status: 400 });
    }
    
    // 各記事から知識を抽出
    const allKnowledgeEntries = [];
    
    for (const article of articles) {
      const knowledgeEntries = await knowledgeBase.extractKnowledgeFromArticle(article);
      allKnowledgeEntries.push(...knowledgeEntries);
    }
    
    // 知識ベースに追加
    knowledgeBase.addKnowledge(allKnowledgeEntries);
    
    return NextResponse.json({
      message: '記事の学習が完了しました',
      articlesCount: articles.length,
      knowledgeEntriesCount: allKnowledgeEntries.length,
      lastUpdate: knowledgeBase.getLastUpdate()?.toISOString()
    });
    
  } catch (error) {
    console.error('Error in learn-articles API:', error);
    return NextResponse.json(
      { error: '記事の学習中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 学習状況を取得するAPIエンドポイント
export async function GET() {
  try {
    const allKnowledge = knowledgeBase.getAllKnowledge();
    const lastUpdate = knowledgeBase.getLastUpdate();
    
    return NextResponse.json({
      knowledgeEntriesCount: allKnowledge.length,
      lastUpdate: lastUpdate?.toISOString(),
      sampleEntries: allKnowledge.slice(0, 5) // 最初の5件をサンプルとして返す
    });
  } catch (error) {
    console.error('Error getting learning status:', error);
    return NextResponse.json(
      { error: '学習状況の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
