import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { condition } = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1️⃣ condition（診断結果）をembedding化
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: condition,
  });

  // 2️⃣ 類似記事をSupabase RPCで検索
  const { data: matches } = await supabase.rpc("match_tea_articles", {
    query_embedding: embedding.data[0].embedding,
    match_threshold: 0.75,
    match_count: 3,
  });

  // 3️⃣ AI回答生成
  const prompt = `
あなたは日本茶の専門家です。
次の健康状態に合わせたおすすめのお茶を提案し、その理由を簡潔に説明してください。

健康状態: ${condition}

参考記事:
${matches?.map((m: any) => `- ${m.title}: ${m.content.slice(0, 100)}...`).join("\n")}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return new Response(JSON.stringify({ answer: response.choices[0].message.content }));
}
