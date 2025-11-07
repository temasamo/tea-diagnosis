// src/scripts/extractKnowledgeFromSyncedArticles.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { ArticleData } from "../lib/knowledge-base";

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

async function extractKnowledgeFromSyncedArticles() {
  console.log("🟢 同期済み記事から知識を抽出開始...\n");

  // 1. 知識抽出がまだ行われていない記事を取得
  console.log("1️⃣ 記事の取得中...");
  const { data: articles, error: articlesError } = await supabase
    .from("tea_articles")
    .select("id, title, content, category, tags, publish_date")
    .order("created_at", { ascending: false });

  if (articlesError) {
    console.error("❌ 記事取得エラー:", articlesError);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log("⚠️ 記事が見つかりませんでした");
    process.exit(0);
  }

  console.log(`📄 ${articles.length}件の記事を取得しました`);

  // 2. 既に知識抽出済みの記事IDを取得
  console.log("\n2️⃣ 既存の知識エントリを確認中...");
  const { data: existingKnowledge, error: knowledgeError } = await supabase
    .from("tea_knowledge_entries")
    .select("source");

  if (knowledgeError) {
    console.error("❌ 知識エントリ取得エラー:", knowledgeError);
    process.exit(1);
  }

  const extractedArticleTitles = new Set(
    (existingKnowledge || []).map((k) => k.source)
  );
  console.log(`📊 既に知識抽出済みの記事: ${extractedArticleTitles.size}件`);

  // 3. 未抽出の記事をフィルタリング
  const articlesToProcess = articles.filter(
    (article) => !extractedArticleTitles.has(article.title)
  );

  console.log(`\n3️⃣ 知識抽出が必要な記事: ${articlesToProcess.length}件`);

  if (articlesToProcess.length === 0) {
    console.log("✅ すべての記事から知識抽出が完了しています");
    process.exit(0);
  }

  // 4. 各記事から知識を抽出（レート制限対策のため、処理間に遅延を追加）
  let success = 0;
  let skipped = 0;
  let errors = 0;
  let totalKnowledgeEntries = 0;

  for (let i = 0; i < articlesToProcess.length; i++) {
    const article = articlesToProcess[i];
    
    // レート制限対策: 5記事ごとに少し待機
    if (i > 0 && i % 5 === 0) {
      console.log(`\n⏸ レート制限対策: 3秒待機中...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    try {
      console.log(`\n📝 処理中: ${article.title}`);

      // tagsの処理（配列または文字列を配列に統一）
      let tags: string[] = [];
      if (article.tags) {
        if (Array.isArray(article.tags)) {
          tags = article.tags;
        } else if (typeof article.tags === "string") {
          tags = article.tags.split(",").map((t) => t.trim()).filter((t) => t);
        }
      }

      const articleData: ArticleData = {
        title: article.title,
        content: article.content,
        category: article.category || "health",
        tags: tags,
        publishDate: article.publish_date || new Date().toISOString().split("T")[0],
      };

      // 知識を抽出（既存記事なので再保存は不要、知識のみ抽出）
      const { knowledgeBase } = await import("../lib/knowledge-base");
      const result = await knowledgeBase.extractKnowledgeFromArticle(articleData);

      if (result.entries && result.entries.length > 0) {
        // 知識エントリを保存（supabaseAdminを使用）
        const { supabaseAdmin } = await import("../lib/supabase");
        const { error: saveError } = await supabaseAdmin
          .from("tea_knowledge_entries")
          .insert(
            result.entries.map((entry) => ({
              id: randomUUID(), // IDを明示的に生成
              condition: entry.condition,
              tea: entry.tea,
              blend: entry.blend,
              sweetener: entry.sweetener,
              snack: entry.snack,
              reason: entry.reason,
              source: entry.source,
            }))
          );

        if (saveError) {
          console.error(`  ❌ 知識保存エラー: ${saveError.message}`);
          errors++;
          continue;
        }

        const knowledgeEntries = result.entries;

        if (knowledgeEntries.length > 0) {
          console.log(`  ✅ ${knowledgeEntries.length}件の知識を抽出しました`);
          totalKnowledgeEntries += knowledgeEntries.length;
          success++;
        } else {
          console.log(`  ⏭ 知識を抽出できませんでした（記事の内容が一般的すぎる可能性）`);
          skipped++;
        }
      } else {
        console.log(`  ⏭ 知識を抽出できませんでした（記事の内容が一般的すぎる可能性）`);
        skipped++;
      }
    } catch (error) {
      console.error(`  ❌ エラー: ${error instanceof Error ? error.message : error}`);
      errors++;
    }
  }

  // 5. 結果を表示
  console.log("\n✨ 知識抽出完了！");
  console.log(`✅ 成功: ${success}件`);
  console.log(`⏭ スキップ: ${skipped}件`);
  console.log(`❌ エラー: ${errors}件`);
  console.log(`📚 抽出された知識エントリ総数: ${totalKnowledgeEntries}件`);

  // 6. 最終統計を表示
  const { supabaseKnowledgeBase: knowledgeBaseForStats } = await import("../lib/supabase-knowledge-base");
  const stats = await knowledgeBaseForStats.getStats();
  console.log("\n📊 最終統計:");
  console.log(`  - 記事数: ${stats.articlesCount}件`);
  console.log(`  - 知識エントリ数: ${stats.knowledgeEntriesCount}件`);
  console.log(`  - 最終更新: ${stats.lastUpdate || "不明"}`);
}

extractKnowledgeFromSyncedArticles().catch((err) => {
  console.error("🚨 致命的なエラー:", err);
  process.exit(1);
});

