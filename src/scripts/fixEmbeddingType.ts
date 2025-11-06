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

async function checkAndFixEmbeddingType() {
  console.log('🔍 embeddingカラムの型を確認中...\n');
  
  try {
    // 現在のカラム型を確認（SQLクエリを使用）
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('check_column_type', {
        table_name: 'tea_articles',
        column_name: 'embedding'
      }).catch(async () => {
        // RPC関数が存在しない場合は、直接データを取得して型を推測
        const { data: sample, error } = await supabase
          .from('tea_articles')
          .select('embedding')
          .limit(1)
          .single();
        
        if (error) throw error;
        return { data: sample, error: null };
      });
    
    // サンプルデータを取得して型を確認
    const { data: sample, error: sampleError } = await supabase
      .from('tea_articles')
      .select('id, embedding')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.error('❌ データ取得エラー:', sampleError.message);
      return;
    }
    
    console.log('📊 現在のembeddingデータ型:', typeof sample.embedding);
    console.log('📊 データ内容:', Array.isArray(sample.embedding) ? `配列 (長さ: ${sample.embedding.length})` : '文字列');
    
    if (typeof sample.embedding === 'string') {
      console.log('\n⚠️  embeddingが文字列型です。vector型に変換する必要があります。');
      console.log('\n📝 以下のSQLをSupabase SQL Editorで実行してください:\n');
      console.log(`
-- 1. embeddingカラムを一時的に削除（データは保持）
ALTER TABLE tea_articles DROP COLUMN IF EXISTS embedding;

-- 2. vector型でembeddingカラムを再作成
ALTER TABLE tea_articles ADD COLUMN embedding vector(1536);

-- 3. 既存のデータがある場合は、embeddingを再生成する必要があります
-- 以下のスクリプトを実行してください:
-- npx tsx src/scripts/generateTeaEmbeddings.ts
      `);
    } else if (Array.isArray(sample.embedding)) {
      console.log('✅ embeddingは配列型です（vector型の可能性があります）');
      console.log('   ただし、Supabaseのvector型として認識されているか確認が必要です。');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkAndFixEmbeddingType();

