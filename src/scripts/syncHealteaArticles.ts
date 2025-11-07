// src/scripts/syncHealteaArticles.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";
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

// ====== 設定 ======
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // サービスロールキーを使用（RLSをバイパス）
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// HealTeaのブレンドティーフォルダ
// 環境変数から取得、なければデフォルトパスを使用
const ARTICLES_DIR =
  process.env.HEALTEA_ARTICLES_DIR ||
  "/Users/teruhikookuyama/workspace/HealTea-Project/healtea-blog/src/content/blog/health/tea/blendedtea";

// ====== メイン処理 ======
async function main() {
  console.log("🟢 Start syncing HealTea articles...");
  console.log(`📁 Articles directory: ${ARTICLES_DIR}`);

  // ディレクトリの存在確認
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`❌ Directory not found: ${ARTICLES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

  console.log(`📄 Found ${files.length} article files`);

  let syncedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      // ハッシュで差分検知（コンテンツベース）
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      // file_pathで既存記事を検索（より確実な方法）
      const { data: existingByPath, error: fetchErrorByPath } = await supabase
        .from("tea_articles")
        .select("id, hash, title")
        .eq("file_path", filePath)
        .maybeSingle();

      if (fetchErrorByPath && fetchErrorByPath.code !== "PGRST116") {
        // PGRST116は「カラムが存在しない」エラー
        console.error(`❌ Supabase fetch error for ${file}:`, fetchErrorByPath);
        errorCount++;
        continue;
      }

      // 既存記事があり、ハッシュが同じ場合はスキップ
      if (existingByPath && existingByPath.hash === hash) {
        console.log(`⏭ Skipped (no changes): ${file}`);
        skippedCount++;
        continue;
      }

      // Embedding生成
      console.log(`🧠 Generating embedding for: ${file}`);
      const embeddingText = `${data.title || ""}\n${content}`;
      
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: embeddingText,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // tagsの処理（配列または文字列を配列に統一）
      let tags: string[] = [];
      if (data.tags) {
        if (Array.isArray(data.tags)) {
          tags = data.tags;
        } else if (typeof data.tags === "string") {
          tags = data.tags.split(",").map((t) => t.trim()).filter((t) => t);
        }
      }

      // Supabase登録/更新
      const articleData: {
        id?: string;
        title: string;
        content: string;
        category: string;
        tags: string[];
        publish_date: string | null;
        embedding: number[];
        file_path?: string;
        hash?: string;
        source?: string;
        synced_at?: string;
        app_name?: string;
      } = {
        title: data.title || path.basename(file, path.extname(file)),
        content,
        category: data.category || "health",
        tags,
        publish_date: data.date || data.publish_date || null,
        embedding,
      };

      // 新規登録の場合はidを生成（既存記事の更新時はidを指定しない）
      if (!existingByPath) {
        articleData.id = crypto.randomUUID();
      }

      // オプショナルフィールドを追加（カラムが存在する場合のみ）
      // まずfile_pathで既存記事があるか確認
      if (existingByPath) {
        // 更新
        articleData.file_path = filePath;
        articleData.hash = hash;
        articleData.source = "healtea-blog";
        articleData.synced_at = new Date().toISOString();
        articleData.app_name = "tea";

        const { error: updateError } = await supabase
          .from("tea_articles")
          .update(articleData)
          .eq("id", existingByPath.id);

        if (updateError) {
          // カラムが存在しない場合は、オプショナルフィールドを除外して再試行
          if (updateError.code === "PGRST116" || updateError.message.includes("column")) {
            console.log(`⚠️ Some optional columns may not exist, trying without them...`);
            const { file_path: _file_path, hash: _hash, source: _source, synced_at: _synced_at, app_name: _app_name, ...basicData } = articleData;
            const { error: retryError } = await supabase
              .from("tea_articles")
              .update(basicData)
              .eq("id", existingByPath.id);

            if (retryError) {
              console.error(`❌ Update error for ${file}:`, retryError);
              errorCount++;
              continue;
            }
          } else {
            console.error(`❌ Update error for ${file}:`, updateError);
            errorCount++;
            continue;
          }
        } else {
          console.log(`✅ Updated: ${file}`);
          syncedCount++;
        }
      } else {
        // 新規登録
        articleData.file_path = filePath;
        articleData.hash = hash;
        articleData.source = "healtea-blog";
        articleData.synced_at = new Date().toISOString();
        articleData.app_name = "tea";

        const { data: _insertedData, error: insertError } = await supabase
          .from("tea_articles")
          .insert(articleData)
          .select()
          .single();

        if (insertError) {
          // カラムが存在しない場合は、オプショナルフィールドを除外して再試行
          if (insertError.code === "PGRST116" || insertError.message.includes("column")) {
            console.log(`⚠️ Some optional columns may not exist, trying without them...`);
            const { file_path: _file_path2, hash: _hash2, source: _source2, synced_at: _synced_at2, app_name: _app_name2, ...basicData } = articleData;
            const { error: retryError } = await supabase
              .from("tea_articles")
              .insert(basicData)
              .select()
              .single();

            if (retryError) {
              console.error(`❌ Insert error for ${file}:`, retryError);
              errorCount++;
              continue;
            }
          } else {
            console.error(`❌ Insert error for ${file}:`, insertError);
            errorCount++;
            continue;
          }
        } else {
          console.log(`✅ Synced (new): ${file}`);
          syncedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
      errorCount++;
    }
  }

  console.log("\n✨ Sync completed!");
  console.log(`✅ Synced: ${syncedCount}`);
  console.log(`⏭ Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

main().catch((err) => {
  console.error("🚨 Fatal error:", err);
  process.exit(1);
});

