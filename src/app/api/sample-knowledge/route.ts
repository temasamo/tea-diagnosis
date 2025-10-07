import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBase } from '@/lib/knowledge-base';

// サンプル記事データ
const sampleArticles = [
  {
    title: "疲れた時に飲むお茶と、相性の良い素材・食べ物",
    content: "疲労を感じたときにおすすめの日本茶やハーブとのブレンド素材、はちみつなどの甘味、さらには一緒に食べると良い食品まで紹介。日常に取り入れやすい癒しのティータイムをご提案します。緑茶にレモンとハチミツを加えることで、疲労回復効果が期待できます。",
    category: "health",
    tags: ["疲労回復", "はちみつ", "ブレンドティー", "日本茶", "お茶と食べ物"],
    publishDate: "2025-10-03"
  },
  {
    title: "季節の変わり目にぴったり！免疫力を高める日本茶ブレンド",
    content: "風邪をひきやすい季節の変わり目におすすめの、免疫力をサポートする日本茶ブレンドをご紹介します。エキナセアや柚子、緑茶などの素材の特徴と効果的な飲み方も解説。エキナセアと柚子を緑茶にブレンドすることで、免疫力向上が期待できます。",
    category: "health",
    tags: ["ブレンドティー", "日本茶", "免疫力", "風邪予防", "エキナセア", "ゆず", "緑茶"],
    publishDate: "2025-10-01"
  },
  {
    title: "目の疲れに効くブレンドティー ― デジタル時代のリラックス習慣",
    content: "スマホやPCで疲れた目に。日本茶とハーブの組み合わせで、目の疲労をやさしくケアするブレンドティーを紹介。ルテイン・アントシアニンを含む素材、飲み方の工夫、生活習慣とあわせて続けるヒントも解説。ブルーベリーとカシスを緑茶にブレンドすることで、目の疲労軽減効果が期待できます。",
    category: "health",
    tags: ["日本茶", "健康", "目の疲れ", "ブレンドティー", "アントシアニン"],
    publishDate: "2025-09-24"
  },
  {
    title: "日本茶と健康 ― 腸のハリ・ガスを軽減するお茶ブレンド",
    content: "腸内のガスやハリに悩む方におすすめのブレンドティーを紹介。日本茶にハーブやスパイスを組み合わせることで、消化促進・整腸作用が期待できます。プーアル茶や黒豆茶が特に効果的で、飲み方やタイミングも解説。",
    category: "health",
    tags: ["日本茶", "健康", "腸活", "ブレンドティー", "消化"],
    publishDate: "2025-09-23"
  },
  {
    title: "飲みすぎた翌朝にすっきり！二日酔い対策ブレンドティー",
    content: "つい飲みすぎた翌朝に、身体を内側からリセットしてくれるブレンドティーをご紹介。肝臓サポートやデトックス効果のある茶葉を厳選し、やさしくケアする方法を解説します。黒糖とハチミツを甘味料として使用することで、二日酔いの症状軽減が期待できます。",
    category: "health",
    tags: ["日本茶", "健康", "二日酔い", "RESET TEA", "ブレンドティー"],
    publishDate: "2025-09-19"
  }
];

export async function POST(request: NextRequest) {
  try {
    const { forceUpdate = false } = await request.json();
    
    // 強制更新でない場合、最近更新されたかチェック
    const lastUpdate = knowledgeBase.getLastUpdate();
    if (!forceUpdate && lastUpdate) {
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 1) { // 1時間以内に更新済み
        return NextResponse.json({ 
          message: '最近更新済みです',
          lastUpdate: lastUpdate.toISOString()
        });
      }
    }
    
    // サンプル記事から知識を抽出
    const allKnowledgeEntries = [];
    
    for (const article of sampleArticles) {
      const knowledgeEntries = await knowledgeBase.extractKnowledgeFromArticle(article);
      allKnowledgeEntries.push(...knowledgeEntries);
    }
    
    // 知識ベースに追加
    knowledgeBase.addKnowledge(allKnowledgeEntries);
    
    return NextResponse.json({
      message: 'サンプル記事の学習が完了しました',
      articlesCount: sampleArticles.length,
      knowledgeEntriesCount: allKnowledgeEntries.length,
      lastUpdate: knowledgeBase.getLastUpdate()?.toISOString(),
      sampleEntries: allKnowledgeEntries.slice(0, 5) // 最初の5件をサンプルとして返す
    });
    
  } catch (error) {
    console.error('Error in sample-knowledge API:', error);
    return NextResponse.json(
      { error: 'サンプル記事の学習中にエラーが発生しました' },
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
    console.error('Error getting sample knowledge status:', error);
    return NextResponse.json(
      { error: 'サンプル知識の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

