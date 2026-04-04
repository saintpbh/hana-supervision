import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let customApiKey = "";
  let openaiApiKey = "";
  let anthropicApiKey = "";
  let customModel = "gemini-2.0-flash";
  
  try {
    const body = await req.json();
    customApiKey = body.apiKey;
    openaiApiKey = body.openaiApiKey;
    anthropicApiKey = body.anthropicApiKey;
    if (body.model) {
      customModel = body.model;
    }
  } catch {}

  try {
    if (customModel.startsWith("gpt-")) {
      const key = openaiApiKey || process.env.OPENAI_API_KEY;
      if (!key) return NextResponse.json({ status: "error", message: "OpenAI API 키가 설정되지 않았습니다", model: null });
      
      const openai = new OpenAI({ apiKey: key });
      const response = await openai.chat.completions.create({
        model: customModel,
        messages: [{ role: "user", content: "안녕" }],
        max_tokens: 10
      });
      return NextResponse.json({
        status: "connected",
        message: response.choices[0]?.message?.content?.slice(0, 50) || "Success",
        model: customModel,
      });
    } else if (customModel.startsWith("claude-")) {
      const key = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) return NextResponse.json({ status: "error", message: "Anthropic API 키가 설정되지 않았습니다", model: null });
      
      const anthropic = new Anthropic({ apiKey: key });
      const response = await anthropic.messages.create({
        model: customModel,
        max_tokens: 10,
        messages: [{ role: "user", content: "안녕" }]
      });
      return NextResponse.json({
        status: "connected",
        // @ts-expect-error type checking compatibility
        message: response.content[0]?.text?.slice(0, 50) || "Success",
        model: customModel,
      });
    } else {
      const key = customApiKey || process.env.GEMINI_API_KEY;
      if (!key) return NextResponse.json({ status: "error", message: "Gemini API 키가 설정되지 않았습니다", model: null });
  
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: customModel });
      const result = await model.generateContent("안녕");
      return NextResponse.json({
        status: "connected",
        message: result.response.text().slice(0, 50),
        model: customModel,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    if (message.includes("429") || message.includes("quota") || message.includes("insufficient_quota")) {
      return NextResponse.json({ status: "quota", message: "API 키는 유효하나 할당량이 초과되었습니다", model: customModel });
    }
    if (message.includes("401") || message.includes("403") || message.includes("API_KEY") || message.includes("invalid_api_key")) {
      return NextResponse.json({ status: "error", message: "API 키가 유효하지 않습니다", model: null });
    }
    if (message.includes("not_found_error") || message.includes("404")) {
      return NextResponse.json({ status: "error", message: "해당 모델에 접근할 수 없습니다. 새 API 키를 발급하거나 3.5를 선택해 주세요.", model: null });
    }
    return NextResponse.json({ status: "error", message: message.slice(0, 100), model: null });
  }
}

