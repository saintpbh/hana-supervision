import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let customApiKey = "";
  let customModel = "gemini-2.0-flash";
  try {
    const body = await req.json();
    customApiKey = body.apiKey;
    if (body.model) {
      customModel = body.model;
    }
  } catch (e) {
    // Ignore parsing errors for empty body
  }

  const apiKey = customApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "API 키가 설정되지 않았습니다",
      model: null,
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: customModel });
    const result = await model.generateContent("안녕");
    const text = result.response.text();

    return NextResponse.json({
      status: "connected",
      message: text.slice(0, 50),
      model: customModel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";

    // Check if it's a quota error (API key is valid but quota exceeded)
    if (message.includes("429") || message.includes("quota")) {
      return NextResponse.json({
        status: "quota",
        message: "API 키는 유효하나 할당량이 초과되었습니다",
        model: customModel,
      });
    }

    // Check if it's an auth error (invalid API key)
    if (message.includes("401") || message.includes("403") || message.includes("API_KEY")) {
      return NextResponse.json({
        status: "error",
        message: "API 키가 유효하지 않습니다",
        model: null,
      });
    }

    return NextResponse.json({
      status: "error",
      message: message.slice(0, 100),
      model: null,
    });
  }
}
