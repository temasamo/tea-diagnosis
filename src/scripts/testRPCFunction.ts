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

async function testRPCFunction() {
  console.log('🔍 RPC関数の動作テスト\n');
  
  try {
    // 1. 実際のembeddingデータを1件取得
    console.log('1️⃣ embeddingデータの取得');
    const { data: sampleArticle, error: sampleError } = await supabase
      .from('tea_articles')
      .select('id, title, embedding')
      .not('embedding', 'is', null)
      .limit(1)
      .single();
    
    if (sampleError || !sampleArticle) {
      console.error('❌ エラー:', sampleError?.message || 'データが見つかりません');
      return;
    }
    
    console.log('   ✅ サンプル記事取得:', sampleArticle.title);
    console.log('   📐 embedding型:', Array.isArray(sampleArticle.embedding) ? `配列 (長さ: ${sampleArticle.embedding.length})` : typeof sampleArticle.embedding);
    
    // 2. RPC関数をテスト
    console.log('\n2️⃣ RPC関数のテスト');
    const { data: rpcResults, error: rpcError } = await supabase.rpc("match_tea_articles", {
      query_embedding: sampleArticle.embedding,
      match_threshold: 0.5, // より低い閾値でテスト
      match_count: 5,
    });
    
    if (rpcError) {
      console.error('   ❌ RPC関数エラー:', rpcError.message);
      console.error('   📝 詳細:', rpcError.details || 'なし');
      console.error('   💡 ヒント:', rpcError.hint || 'なし');
      console.error('   🔢 エラーコード:', rpcError.code || 'なし');
      
      // エラーの詳細を分析
      if (rpcError.message.includes('operator does not exist')) {
        console.log('\n   ⚠️  演算子エラー: embeddingカラムがvector型として認識されていない可能性があります');
      } else if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
        console.log('\n   ⚠️  RPC関数が存在しないか、パラメータが一致していません');
      }
    } else {
      console.log('   ✅ RPC関数実行成功');
      console.log('   📊 結果件数:', rpcResults?.length || 0);
      
      if (rpcResults && rpcResults.length > 0) {
        console.log('\n   📄 見つかった記事:');
        rpcResults.forEach((result: any, index: number) => {
          console.log(`   ${index + 1}. ${result.title} (similarity: ${result.similarity?.toFixed(4) || 'N/A'})`);
        });
      } else {
        console.log('   ⚠️  マッチする記事が見つかりませんでした');
        console.log('   💡 閾値を下げるか、embeddingデータを確認してください');
      }
    }
    
    // 3. 実際のクエリでテスト（OpenAI Embeddingを使用）
    console.log('\n3️⃣ 実際のクエリでのテスト');
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const testQuery = '疲れている リラックスしたい';
    console.log('   📝 テストクエリ:', testQuery);
    
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: testQuery,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('   ✅ Embedding生成完了 (長さ:', queryEmbedding.length, ')');
    
    const { data: queryResults, error: queryError } = await supabase.rpc("match_tea_articles", {
      query_embedding: queryEmbedding,
      match_threshold: 0.75,
      match_count: 3,
    });
    
    if (queryError) {
      console.error('   ❌ クエリテストエラー:', queryError.message);
    } else {
      console.log('   ✅ クエリテスト成功');
      console.log('   📊 結果件数:', queryResults?.length || 0);
      
      if (queryResults && queryResults.length > 0) {
        console.log('\n   📄 見つかった記事:');
        queryResults.forEach((result: any, index: number) => {
          console.log(`   ${index + 1}. ${result.title} (similarity: ${result.similarity?.toFixed(4) || 'N/A'})`);
        });
      } else {
        console.log('   ⚠️  マッチする記事が見つかりませんでした');
      }
    }
    
    console.log('\n✅ テスト完了！');
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
  }
}

testRPCFunction();

