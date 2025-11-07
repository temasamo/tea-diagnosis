// src/scripts/checkRAGStatus.ts
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

async function checkRAGStatus() {
  console.log("🔍 RAG検索の状態を確認中...\n");

  // 1. 記事の総数とembeddingの有無を確認
  console.log("1️⃣ 記事の状態確認");
  const { data: articles, error: articlesError } = await supabase
    .from("tea_articles")
    .select("id, title, embedding")
    .limit(10);

  if (articlesError) {
    console.error("❌ エラー:", articlesError);
    return;
  }

  console.log(`   📊 総記事数（最初の10件）: ${articles?.length || 0}`);
  
  const withEmbedding = articles?.filter(a => a.embedding !== null) || [];
  const withoutEmbedding = articles?.filter(a => a.embedding === null) || [];
  
  console.log(`   ✅ embeddingあり: ${withEmbedding.length}件`);
  console.log(`   ❌ embeddingなし: ${withoutEmbedding.length}件`);

  if (withEmbedding.length > 0) {
    const first = withEmbedding[0];
    console.log(`\n   📄 サンプル記事: ${first.title}`);
    console.log(`   📐 embedding型: ${Array.isArray(first.embedding) ? `配列 (長さ: ${first.embedding.length})` : typeof first.embedding}`);
    
    // embeddingが配列かどうか確認
    if (Array.isArray(first.embedding)) {
      console.log(`   ✅ embeddingは配列形式（正しい）`);
    } else {
      console.log(`   ⚠️ embeddingが配列形式ではない（問題の可能性）`);
    }
  }

  // 2. RPC関数のテスト
  console.log("\n2️⃣ RPC関数のテスト");
  if (withEmbedding.length > 0) {
    const testEmbedding = withEmbedding[0].embedding;
    
    // 異なるthresholdでテスト
    const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];
    
    for (const threshold of thresholds) {
      const { data: rpcResults, error: rpcError } = await supabase.rpc("match_tea_articles", {
        query_embedding: testEmbedding,
        match_threshold: threshold,
        match_count: 5,
      });

      if (rpcError) {
        console.error(`   ❌ threshold ${threshold} でエラー:`, rpcError.message);
      } else {
        console.log(`   📊 threshold ${threshold}: ${rpcResults?.length || 0}件見つかりました`);
        if (rpcResults && rpcResults.length > 0) {
          rpcResults.forEach((r: { title: string; similarity?: number }, i: number) => {
            console.log(`      ${i + 1}. ${r.title} (similarity: ${r.similarity?.toFixed(4) || 'N/A'})`);
          });
        }
      }
    }
  } else {
    console.log("   ⚠️ embeddingがある記事がないため、RPC関数をテストできません");
  }

  // 3. 実際の診断文のembeddingでテスト
  console.log("\n3️⃣ 実際の診断文embeddingでテスト");
  const testQuery = "疲れを感じており、リラックスしたい";
  
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: testQuery,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log(`   ✅ テストクエリ: "${testQuery}"`);
    console.log(`   📐 embedding生成完了 (長さ: ${queryEmbedding.length})`);
    
    // 異なるthresholdでテスト
    for (const threshold of [0.3, 0.4, 0.5, 0.6]) {
      const { data: queryResults, error: queryError } = await supabase.rpc("match_tea_articles", {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: 5,
      });

      if (queryError) {
        console.error(`   ❌ threshold ${threshold} でエラー:`, queryError.message);
      } else {
        console.log(`   📊 threshold ${threshold}: ${queryResults?.length || 0}件見つかりました`);
        if (queryResults && queryResults.length > 0) {
          queryResults.forEach((r: { title: string; similarity?: number }, i: number) => {
            console.log(`      ${i + 1}. ${r.title} (similarity: ${r.similarity?.toFixed(4) || 'N/A'})`);
          });
        }
      }
    }
  } catch (error) {
    console.error("   ❌ embedding生成エラー:", error);
  }

  // 4. 同期した記事の確認
  console.log("\n4️⃣ 同期した記事（healtea-blog）の確認");
  const { data: syncedArticles, error: syncedError } = await supabase
    .from("tea_articles")
    .select("id, title, source, embedding")
    .eq("source", "healtea-blog")
    .limit(5);

  if (syncedError) {
    console.log(`   ⚠️ sourceカラムが存在しない可能性: ${syncedError.message}`);
  } else {
    console.log(`   📊 同期記事数（最初の5件）: ${syncedArticles?.length || 0}`);
    if (syncedArticles && syncedArticles.length > 0) {
      syncedArticles.forEach((a, i) => {
        const hasEmbedding = a.embedding !== null;
        console.log(`      ${i + 1}. ${a.title} (embedding: ${hasEmbedding ? '✅' : '❌'})`);
      });
    }
  }

  console.log("\n✅ 確認完了！");
}

checkRAGStatus().catch((err) => {
  console.error("🚨 エラー:", err);
  process.exit(1);
});


