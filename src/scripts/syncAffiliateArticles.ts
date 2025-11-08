import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/**
 * =====================================================
 *  MarketSupporterAI（Affiliate記事） → Supabase 同期スクリプト
 * =====================================================
 * ・HealTea構成と同等の仕組み
 * ・GitHub Actions／ローカル共通で動作
 * ・RAG用ベクトル生成
 */

// --- メイン処理 ----------------------------------------------------
async function main() {
  console.log("🟢 Start syncing MarketSupporterAI (Affiliate) articles...");

  // --- 環境変数読込 ----------------------------------------------------
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`❌ .env.local not found at ${envPath}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const envVars = envContent.split("\n").reduce((acc, line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      acc[key.trim()] = valueParts.join("=").trim();
    }
    return acc;
  }, {} as Record<string, string>);
  Object.assign(process.env, envVars);

  // --- Supabase & OpenAI 初期化 ---------------------------------------
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // --- 同期ディレクトリ設定 ------------------------------------------
  const BASE_DIR =
    process.env.AFFILIATE_ARTICLES_DIR ||
    path.join(process.cwd(), "../affiliate-blog/articles/japanesetea");

  const SUB_DIRS = ["knowledge", "recommend"];
  const SOURCE = "marketsupporter-ai";
  const APP_NAME = "tea";

  // --- 実行開始ログ ----------------------------------------------------
  console.log(`📁 Base directory: ${BASE_DIR}`);
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`❌ Directory not found: ${BASE_DIR}`);
    process.exit(1);
  }

  // --- 記事ファイルを収集 ---------------------------------------------
  const files: string[] = [];
  for (const sub of SUB_DIRS) {
    const dirPath = path.join(BASE_DIR, sub);
    if (!fs.existsSync(dirPath)) {
      console.warn(`⚠️ Subdirectory not found: ${dirPath}`);
      continue;
    }
    for (const file of fs.readdirSync(dirPath)) {
      if (file.endsWith(".mdx")) files.push(path.join(dirPath, file));
    }
  }
  console.log(`📄 Found ${files.length} article files`);

  let success = 0,
    skipped = 0,
    errors = 0;

  // --- 各記事を処理 ---------------------------------------------------
  for (const filePath of files) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const titleMatch = content.match(/title:\s*["'](.+?)["']/);
    const title = titleMatch ? titleMatch[1] : path.basename(filePath, ".mdx");

    // --- 既存チェック
    const { data: existing, error: fetchError } = await supabase
      .from("tea_articles")
      .select("id, hash")
      .eq("file_path", filePath)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error(`❌ Supabase fetch error for ${path.basename(filePath)}:`, fetchError);
      errors++;
      continue;
    }

    // --- ハッシュが同じならスキップ
    if (existing && existing.hash === hash) {
      console.log(`⏭ Skipped (no changes): ${path.basename(filePath)}`);
      skipped++;
      continue;
    }

    // --- OpenAI Embedding生成
    console.log(`🧠 Generating embedding for: ${path.basename(filePath)}`);
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `${title}\n${content}`,
    });

    // --- レコード作成
    const record: {
      id?: string;
      title: string;
      content: string;
      category: string;
      tags: string[];
      publish_date: string;
      embedding: number[];
      file_path: string;
      hash: string;
      source: string;
      app_name: string;
      synced_at: string;
    } = {
      title,
      content,
      category: "knowledge",
      tags: [],
      publish_date: new Date().toISOString(),
      embedding: embedding.data[0].embedding,
      file_path: filePath,
      hash,
      source: SOURCE,
      app_name: APP_NAME,
      synced_at: new Date().toISOString(),
    };

    // --- 新規登録の場合はidを生成
    if (!existing) {
      record.id = crypto.randomUUID();
    }

    // --- SupabaseへINSERT/UPDATE
    let dbError;
    if (existing) {
      // 更新
      const { error: updateError } = await supabase
        .from("tea_articles")
        .update(record)
        .eq("file_path", filePath);
      dbError = updateError;
    } else {
      // 新規登録
      const { error: insertError } = await supabase
        .from("tea_articles")
        .insert(record);
      dbError = insertError;
    }

    if (dbError) {
      console.error(`❌ Supabase error: ${path.basename(filePath)}`, dbError);
      errors++;
    } else {
      console.log(`✅ Synced (new/updated): ${path.basename(filePath)}`);
      success++;
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err);
    errors++;
  }
}

  // --- 結果 -----------------------------------------------------------
  console.log(`✨ Sync completed! ✅ Synced: ${success} ⏭ Skipped: ${skipped} ❌ Errors: ${errors}`);
}

main().catch((err) => {
  console.error("🚨 Fatal error:", err);
  process.exit(1);
});
