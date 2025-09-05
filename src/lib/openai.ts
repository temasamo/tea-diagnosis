// src/lib/openai.ts
import OpenAI from "openai";

// 環境変数が無い場合は null（モック用の分岐で使う）
export const openai =
  process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default openai;
