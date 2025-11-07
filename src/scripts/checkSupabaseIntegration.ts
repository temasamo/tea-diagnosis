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
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkIntegration() {
  console.log('🔍 Supabase統合状況を確認中...\n');
  
  // 1. 接続確認
  console.log('1️⃣ 接続確認');
  console.log('   URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('   Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key (使用中)' : 'Anon Key (使用中)');
  
  try {
    // 2. tea_articlesテーブルの存在確認
    console.log('\n2️⃣ tea_articlesテーブル確認');
    const { data: articles, error: articlesError } = await supabase
      .from('tea_articles')
      .select('id, title, content')
      .limit(1);
    
    if (articlesError) {
      console.error('   ❌ エラー:', articlesError.message);
    } else {
      console.log('   ✅ テーブル存在確認: OK');
      console.log('   📊 データ件数（サンプル）:', articles?.length || 0);
      
      // テーブル構造を確認（embeddingカラムがあるか）
      const { data: fullArticle, error: fullError } = await supabase
        .from('tea_articles')
        .select('*')
        .limit(1)
        .single();
      
      if (!fullError && fullArticle) {
        const hasEmbedding = 'embedding' in fullArticle;
        console.log('   📋 embeddingカラム:', hasEmbedding ? '✅ 存在' : '❌ 存在しない');
        if (hasEmbedding) {
          const embedding = fullArticle.embedding;
          console.log('   📐 embedding型:', Array.isArray(embedding) ? `配列 (長さ: ${embedding.length})` : typeof embedding);
          console.log('   📊 embedding値:', embedding ? 'データあり' : 'NULL');
        }
      }
    }
    
    // 3. RPC関数の存在確認
    console.log('\n3️⃣ match_tea_articles RPC関数確認');
    
    // ダミーのembeddingでRPC関数をテスト
    const testEmbedding = new Array(1536).fill(0.1); // text-embedding-3-smallの次元数
    
    const { data: rpcData, error: rpcError } = await supabase.rpc("match_tea_articles", {
      query_embedding: testEmbedding,
      match_threshold: 0.5,
      match_count: 1,
    });
    
    if (rpcError) {
      console.error('   ❌ RPC関数エラー:', rpcError.message);
      console.error('   📝 詳細:', rpcError.details || 'なし');
      console.error('   💡 ヒント:', rpcError.hint || 'なし');
      console.error('   🔢 エラーコード:', rpcError.code || 'なし');
      
      if (rpcError.message.includes('does not exist')) {
        console.log('\n   ⚠️  RPC関数が存在しません。以下のSQLを実行して作成してください:');
        console.log(`
CREATE OR REPLACE FUNCTION match_tea_articles (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tea_articles.id,
    tea_articles.title,
    tea_articles.content,
    1 - (tea_articles.embedding <=> query_embedding) AS similarity
  FROM tea_articles
  WHERE 1 - (tea_articles.embedding <=> query_embedding) > match_threshold
  ORDER BY tea_articles.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
        `);
      }
    } else {
      console.log('   ✅ RPC関数存在確認: OK');
      console.log('   📊 テスト結果:', rpcData?.length || 0, '件');
    }
    
    // 4. データ件数確認
    console.log('\n4️⃣ データ件数確認');
    const { count, error: countError } = await supabase
      .from('tea_articles')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('   ❌ エラー:', countError.message);
    } else {
      console.log('   📊 総記事数:', count || 0);
      
      // embeddingがある記事数
      const { count: embeddingCount, error: embeddingCountError } = await supabase
        .from('tea_articles')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);
      
      if (!embeddingCountError) {
        console.log('   📊 embeddingありの記事数:', embeddingCount || 0);
        if (count && embeddingCount && count > embeddingCount) {
          console.log('   ⚠️  一部の記事にembeddingがありません');
          console.log('   💡 実行コマンド: npx tsx src/scripts/generateTeaEmbeddings.ts');
        }
      }
    }
    
    // 5. 環境変数の確認
    console.log('\n5️⃣ 環境変数確認');
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY'
    ];
    
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`   ✅ ${varName}: 設定済み (${value.substring(0, 20)}...)`);
      } else {
        console.log(`   ❌ ${varName}: 未設定`);
      }
    });
    
    console.log('\n✅ 確認完了！');
    
  } catch (error) {
    console.error('❌ 確認中にエラーが発生しました:', error);
  }
}

checkIntegration();



