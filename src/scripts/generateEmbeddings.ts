/**
 * Supabase上の更新記事に対してOpenAI Embeddingを再生成するスクリプト
 * 対象: updated_at が24時間以内に更新された記事のうち、
 *      - embeddingがnullの記事
 *      - または、hashが変更された記事（内容が変更された記事）
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import crypto from "crypto";

// 環境変数を手動で読み込み（他のスクリプトと同じパターン）
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

// --- クライアント初期化 ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// --- 実行 ---
async function main() {
  console.log("🔍 Embedding再生成ジョブ開始\n");

  // 実行タイプを判定（環境変数から、またはデフォルトで'scheduled'）
  const executionType = process.env.GITHUB_ACTIONS ? 'scheduled' : 'manual';
  const startedAt = new Date().toISOString();

  // ログレコードを作成
  let logId: string | null = null;
  let success = 0;
  let errors = 0;
  let totalProcessed = 0;
  const failedArticles: Array<{ id: string; title: string; error: string }> = [];

  try {
    const { data: logData, error: logError } = await supabase
      .from("embedding_generation_logs")
      .insert({
        execution_type: executionType,
        started_at: startedAt,
        total_processed: 0,
        success_count: 0,
        error_count: 0,
      })
      .select("id")
      .single();

    if (logError) {
      console.warn("⚠️ ログ記録の作成に失敗しました（処理は続行します）:", logError.message);
    } else {
      logId = logData?.id || null;
      console.log(`📝 ログID: ${logId}\n`);
    }
  } catch (err) {
    console.warn("⚠️ ログ記録の作成に失敗しました（処理は続行します）:", err);
  }

  // ログ更新用のヘルパー関数
  const updateLog = async (updates: {
    completed_at?: string;
    total_processed?: number;
    success_count?: number;
    error_count?: number;
    failed_article_ids?: string[];
    error_summary?: string | null;
  }) => {
    if (logId) {
      try {
        await supabase
          .from("embedding_generation_logs")
          .update(updates)
          .eq("id", logId);
      } catch (err) {
        console.warn("⚠️ ログ更新に失敗しました:", err);
      }
    }
  };

  // 24時間以内に更新された記事を抽出
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log(`📅 対象期間: ${twentyFourHoursAgo} 以降に更新された記事\n`);

  const { data: updatedArticles, error } = await supabase
    .from("tea_articles")
    .select("id, title, content, updated_at, hash, embedding")
    .gte("updated_at", twentyFourHoursAgo)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("❌ 記事取得エラー:", error);
    await updateLog({
      completed_at: new Date().toISOString(),
      error_summary: `記事取得エラー: ${error.message}`,
    });
    process.exit(1);
  }

  if (!updatedArticles || updatedArticles.length === 0) {
    console.log("✅ 更新記事なし。Embedding再生成をスキップ。");
    await updateLog({
      completed_at: new Date().toISOString(),
      total_processed: 0,
    });
    return;
  }

  console.log(`📝 24時間以内に更新された記事数: ${updatedArticles.length}件\n`);

  // 実際にembedding再生成が必要な記事をフィルタリング
  const articlesToProcess = [];
  for (const article of updatedArticles) {
    // 現在のcontentからhashを計算
    const currentHash = crypto.createHash("sha256").update(article.content || "").digest("hex");
    
    // embeddingがnull、またはhashが変更された場合のみ対象
    if (!article.embedding || article.hash !== currentHash) {
      articlesToProcess.push({ ...article, currentHash });
    }
  }

  if (articlesToProcess.length === 0) {
    console.log("✅ 内容が変更された記事またはembeddingがnullの記事はありません。");
    console.log("   （既にembeddingが存在し、内容も変更されていない記事はスキップされます）");
    await updateLog({
      completed_at: new Date().toISOString(),
      total_processed: updatedArticles.length,
    });
    return;
  }

  console.log(`📝 実際に処理する記事数: ${articlesToProcess.length}件\n`);
  totalProcessed = articlesToProcess.length;
  const succeededArticles: Array<{ id: string; title: string; reason: string }> = [];

  for (const article of articlesToProcess) {
    try {
      const reason = !article.embedding 
        ? "embeddingがnull" 
        : "内容が変更された";
      console.log(`🔄 処理中: ${article.title} (理由: ${reason})`);

      // コンテンツの長さチェック（OpenAI APIの制限対策）
      const inputText = `${article.title}\n\n${article.content}`;
      if (inputText.length > 8000) {
        console.warn(`  ⚠️ コンテンツが長すぎます (${inputText.length}文字)。最初の8000文字のみ使用します。`);
      }

      // OpenAI Embedding生成（失敗時のリトライなし）
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: inputText.slice(0, 8000), // 長すぎる場合は切り詰め
      });

      const embedding = embeddingRes.data[0].embedding;

      // tea_articlesテーブルのembeddingカラムを直接更新
      // hashも更新（内容が変更された場合）
      const { error: updateError } = await supabase
        .from("tea_articles")
        .update({
          embedding: embedding,
          hash: article.currentHash, // 新しいhashを設定
          updated_at: new Date().toISOString(), // updated_atも更新
        })
        .eq("id", article.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`  ✅ Embeddingを更新しました\n`);
      success++;
      
      // 成功した記事を記録
      succeededArticles.push({
        id: article.id,
        title: article.title,
        reason: reason,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Embedding生成失敗:`, errorMessage);
      
      // 失敗した記事を記録（費用追跡のため）
      failedArticles.push({
        id: article.id,
        title: article.title,
        error: errorMessage,
      });
      errors++;

      // 一時的なエラー（レート制限など）の場合は警告
      if (errorMessage.includes("rate_limit") || errorMessage.includes("429")) {
        console.warn(`  ⚠️ レート制限エラー。次回実行時に再試行されます。`);
      } else if (errorMessage.includes("quota") || errorMessage.includes("insufficient")) {
        console.error(`  🚨 クォータ不足エラー。APIキーの確認が必要です。`);
      }
    }
  }

  console.log("\n🎉 Embedding再生成ジョブ完了");
  console.log(`✅ 成功: ${success}件`);
  console.log(`❌ エラー: ${errors}件`);

  // 成功した記事の詳細を出力
  if (succeededArticles.length > 0) {
    console.log("\n✅ 成功した記事一覧:");
    succeededArticles.forEach((article, index) => {
      console.log(`  ${index + 1}. ${article.title} (ID: ${article.id}) - ${article.reason}`);
    });
  }

  // 失敗した記事の詳細を出力（費用追跡のため）
  if (failedArticles.length > 0) {
    console.log("\n⚠️ 失敗した記事一覧（次回実行時に再試行されます）:");
    failedArticles.forEach((article, index) => {
      console.log(`  ${index + 1}. ${article.title} (ID: ${article.id})`);
      console.log(`     エラー: ${article.error}`);
    });
    console.log("\n💡 注意: 失敗した記事は次回実行時に再試行されます。");
    console.log("     同じエラーが繰り返される場合は、手動で確認してください。");
  }

  // ログを更新（実行結果を記録）
  const errorSummary = failedArticles.length > 0
    ? `${failedArticles.length}件の記事でエラーが発生しました。主なエラー: ${failedArticles[0].error.substring(0, 100)}`
    : null;

  await updateLog({
    completed_at: new Date().toISOString(),
    total_processed: totalProcessed,
    success_count: success,
    error_count: errors,
    failed_article_ids: failedArticles.map(a => a.id),
    error_summary: errorSummary,
  });
  
  if (logId) {
    console.log(`\n📝 実行ログを記録しました（ログID: ${logId}）`);
  }

  // ログ出力先の説明
  console.log("\n📋 ログの出力先:");
  console.log("  - 手動実行: ターミナル/コンソール");
  console.log("  - GitHub Actions: Actionsタブ → 該当ワークフローのログ");
  console.log("    URL: https://github.com/[owner]/[repo]/actions");
  console.log("  - 管理画面: http://localhost:3002/admin → 学習履歴タブ");
}

main().catch(async (err) => {
  console.error("🚨 致命的なエラー:", err);
  
  // ログが作成されていた場合、エラーとして記録を試みる
  // 注意: この時点でlogIdはスコープ外なので、エラーが発生した場合は
  // ログテーブルから最新の未完了ログを探して更新する
  try {
    const { data: latestLog } = await supabase
      .from("embedding_generation_logs")
      .select("id")
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (latestLog?.id) {
      await supabase
        .from("embedding_generation_logs")
        .update({
          completed_at: new Date().toISOString(),
          error_summary: `致命的なエラー: ${err instanceof Error ? err.message : String(err)}`,
        })
        .eq("id", latestLog.id);
    }
  } catch (_logErr) {
    // ログ更新も失敗した場合は無視
  }
  
  process.exit(1);
});

