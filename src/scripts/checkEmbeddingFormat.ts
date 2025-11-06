import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// 環境変数を手動で読み込み
const envPath = join(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
const envVars = envContent.split("\n").reduce((acc, line) => {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    acc[key.trim()] = valueParts.join("=").trim();
  }
  return acc;
}, {} as Record<string, string>);

Object.assign(process.env, envVars);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkEmbeddingFormat() {
  console.log('🔍 embeddingデータの形式を確認中...\n');
  
  try {
    // embeddingデータを直接取得
    const { data: articles, error } = await supabase
      .from('tea_articles')
      .select('id, title, embedding')
      .not('embedding', 'is', null)
      .limit(3);
    
    if (error) {
      console.error('❌ エラー:', error.message);
      return;
    }
    
    console.log(`📊 ${articles?.length || 0}件の記事を確認\n`);
    
    articles?.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   ID: ${article.id}`);
      console.log(`   embedding型: ${typeof article.embedding}`);
      
      if (typeof article.embedding === 'string') {
        console.log(`   ⚠️  文字列型です`);
        try {
          const parsed = JSON.parse(article.embedding);
          if (Array.isArray(parsed)) {
            console.log(`   ✅ JSON文字列として配列に変換可能 (長さ: ${parsed.length})`);
            console.log(`   💡 このデータは文字列として保存されていますが、vector型に変換する必要があります`);
          } else {
            console.log(`   ❌ JSON解析結果が配列ではありません`);
          }
        } catch (e) {
          console.log(`   ❌ JSON解析エラー: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      } else if (Array.isArray(article.embedding)) {
        console.log(`   ✅ 配列型 (長さ: ${article.embedding.length})`);
        console.log(`   📐 最初の5要素:`, article.embedding.slice(0, 5));
      } else {
        console.log(`   ⚠️  予期しない型: ${typeof article.embedding}`);
      }
      console.log('');
    });
    
    // 推奨アクション
    console.log('\n📝 推奨アクション:');
    if (articles?.some(a => typeof a.embedding === 'string')) {
      console.log('   1. embeddingデータを再生成することをおすすめします');
      console.log('      npx tsx src/scripts/generateTeaEmbeddings.ts');
      console.log('');
      console.log('   2. または、Supabase SQL Editorで以下のSQLを実行して変換:');
      console.log(`
-- embeddingがJSON文字列の場合、vector型に変換
UPDATE tea_articles 
SET embedding = embedding::vector(1536)
WHERE embedding IS NOT NULL;
      `);
    } else {
      console.log('   ✅ embeddingデータは正しい形式です');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkEmbeddingFormat();

