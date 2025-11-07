// src/scripts/testActualQuery.ts
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testActualQuery() {
  // 実際の診断文でテスト
  const actualQuery = "あなたは疲れを感じており、一人の時間を大切にしながら集中力を高めたいと考えています。緑茶を選ぶことで、リフレッシュしつつ心を落ち着けることができるでしょう。";

  console.log("🔍 実際の診断文でテスト:");
  console.log("クエリ:", actualQuery);
  console.log("");

  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: actualQuery,
  });

  console.log(`✅ Embedding生成完了 (長さ: ${embedding.data[0].embedding.length})`);
  console.log("");

  for (const threshold of [0.3, 0.4, 0.5, 0.6]) {
    const { data, error } = await supabase.rpc("match_tea_articles", {
      query_embedding: embedding.data[0].embedding,
      match_threshold: threshold,
      match_count: 5,
    });

    if (error) {
      console.log(`threshold ${threshold}: エラー - ${error.message}`);
    } else {
      console.log(`threshold ${threshold}: ${data?.length || 0}件`);
      if (data && data.length > 0) {
        data.forEach((r: { title: string; similarity?: number }, i: number) => {
          console.log(`  ${i + 1}. ${r.title} (similarity: ${r.similarity?.toFixed(4)})`);
        });
      }
    }
    console.log("");
  }
}

testActualQuery().catch((err) => {
  console.error("🚨 エラー:", err);
  process.exit(1);
});


