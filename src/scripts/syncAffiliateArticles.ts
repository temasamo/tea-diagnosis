import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// 環境変数を手動で読み込み（generateTeaEmbeddings.tsと同じパターン）
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = envContent.split("\n").reduce((acc, line) => {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    acc[key.trim()] = valueParts.join("=").trim();
  }
  return acc;
}, {} as Record<string, string>);

// 環境変数を設定
Object.assign(process.env, envVars);

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 同期対象ディレクトリ
// 環境変数から取得、なければデフォルトパスを使用
const BASE_DIR = process.env.AFFILIATE_ARTICLES_DIR ||
  "/Users/teruhikookuyama/workspace/Affiliate-Project/affiliate-blog/articles/japanesetea";
const SUB_DIRS = ["knowledge", "recommend"];
const SOURCE = "marketsupporter-ai";
const APP_NAME = "tea";

// MDXファイル読込 & 埋め込み生成
async function main() {
  console.log("🟢 Start syncing Affiliate articles...");
  console.log(`📁 Base directory: ${BASE_DIR}`);
  
  // ディレクトリの存在確認
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`❌ Directory not found: ${BASE_DIR}`);
    process.exit(1);
  }

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

  let success = 0, skipped = 0, errors = 0;

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      const titleMatch = content.match(/title:\s*["'](.+?)["']/);
      const title = titleMatch ? titleMatch[1] : path.basename(filePath, ".mdx");

      // 既存データ検索
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

      // 変更なしならスキップ
      if (existing && existing.hash === hash) {
        console.log(`⏭ Skipped (no changes): ${path.basename(filePath)}`);
        skipped++;
        continue;
      }

      console.log(`🧠 Generating embedding for: ${path.basename(filePath)}`);
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: `${title}\n${content}`,
      });

      const record: {
        id?: string;
        title: string;
        content: string;
        category: string;
        tags: string[];
        publish_date: string;
        embedding: number[];
        file_path?: string;
        hash?: string;
        source?: string;
        app_name?: string;
        synced_at?: string;
      } = {
        title,
        content,
        category: "knowledge",
        tags: ["日本茶", "健康"],
        publish_date: new Date().toISOString().split("T")[0],
        embedding: embedding.data[0].embedding,
      };

      // オプショナルフィールドを追加
      record.file_path = filePath;
      record.hash = hash;
      record.source = SOURCE;
      record.app_name = APP_NAME;
      record.synced_at = new Date().toISOString();

      // 新規登録の場合はidを生成
      if (!existing) {
        record.id = crypto.randomUUID();
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from("tea_articles")
          .update(record)
          .eq("id", existing.id);

        if (updateError) {
          // カラムが存在しない場合は、オプショナルフィールドを除外して再試行
          if (updateError.code === "PGRST116" || updateError.message.includes("column")) {
            console.log(`⚠️ Some optional columns may not exist, trying without them...`);
            const { file_path: _file_path, hash: _hash, source: _source, synced_at: _synced_at, app_name: _app_name, ...basicData } = record;
            const { error: retryError } = await supabase
              .from("tea_articles")
              .update(basicData)
              .eq("id", existing.id);

            if (retryError) {
              console.error(`❌ Update error for ${path.basename(filePath)}:`, retryError);
              errors++;
              continue;
            }
          } else {
            console.error(`❌ Update error for ${path.basename(filePath)}:`, updateError);
            errors++;
            continue;
          }
        } else {
          console.log(`✅ Updated: ${path.basename(filePath)}`);
          success++;
        }
      } else {
        const { data: _insertedData, error: insertError } = await supabase
          .from("tea_articles")
          .insert(record)
          .select()
          .single();

        if (insertError) {
          // カラムが存在しない場合は、オプショナルフィールドを除外して再試行
          if (insertError.code === "PGRST116" || insertError.message.includes("column")) {
            console.log(`⚠️ Some optional columns may not exist, trying without them...`);
            const { file_path: _file_path2, hash: _hash2, source: _source2, synced_at: _synced_at2, app_name: _app_name2, ...basicData } = record;
            const { error: retryError } = await supabase
              .from("tea_articles")
              .insert(basicData)
              .select()
              .single();

            if (retryError) {
              console.error(`❌ Insert error for ${path.basename(filePath)}:`, retryError);
              errors++;
              continue;
            }
          } else {
            console.error(`❌ Insert error for ${path.basename(filePath)}:`, insertError);
            errors++;
            continue;
          }
        } else {
          console.log(`✅ Synced (new): ${path.basename(filePath)}`);
          success++;
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${path.basename(filePath)}:`, err);
      errors++;
    }
  }

  console.log("\n✨ Sync completed!");
  console.log(`✅ Synced: ${success}`);
  console.log(`⏭ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch((err) => {
  console.error("🚨 Fatal error:", err);
  process.exit(1);
});
