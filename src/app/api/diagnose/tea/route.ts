import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { condition } = await req.json();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // AI回答生成
    const prompt = `
あなたは日本茶の専門家です。
次の健康状態に合わせたおすすめのお茶を提案し、その理由を簡潔に説明してください。

健康状態: ${condition}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return new Response(
      JSON.stringify({
        answer: response.choices[0].message.content,
        articles: [],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in diagnose/tea API:', error);
    return new Response(
      JSON.stringify({ error: '診断中にエラーが発生しました' }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
