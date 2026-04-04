import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileData, mimeType, aiInstructions } = body;

    const apiKey = aiInstructions?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다. 인공지능 설정에서 키를 입력하거나, 환경 변수를 설정하세요." },
        { status: 400 }
      );
    }

    if (!fileData) {
      return NextResponse.json({ error: "파일 데이터가 없습니다." }, { status: 400 });
    }

    const customModel = aiInstructions?.model || "gemini-2.0-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: customModel });

    const prompt = `첨부된 문서는 상담 내담자의 기본 정보, 내담 기록 또는 행정 정보입니다.
문서 내용을 분석하여 다음 필드들의 값을 추출해 주세요. 
해당하는 정보가 없다면 빈 문자열("")로 남겨주세요.
JSON 형식으로만 정확히 답변해주세요.

분석 대상 정보:
1. 상담자명 (counselorName)
2. 소속기관 (organization)
3. 수퍼바이저명 (supervisorName)
4. 상담일시 (sessionDate)
5. 장소 (location)
6. 내담자 식별코드 또는 이름 (clientCode)
7. 내담자 연령 (age)
8. 내담자 성별 (gender)
9. 내담자 직업 (occupation)
10. 주 호소 문제 (chiefComplaint)
11. 상담 동기 및 경위 (counselingMotivation)`;

    // Remove the data:mimeType;base64, prefix if it exists
    let cleanBase64 = fileData;
    if (fileData.includes(",")) {
      cleanBase64 = fileData.split(",")[1];
    }

    const inlineData = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType || "application/pdf",
      },
    };

    // Define JSON Schema for extraction
    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        adminInfo: {
          type: SchemaType.OBJECT,
          properties: {
            counselorName: { type: SchemaType.STRING },
            organization: { type: SchemaType.STRING },
            supervisorName: { type: SchemaType.STRING },
            sessionDate: { type: SchemaType.STRING },
            location: { type: SchemaType.STRING },
          },
        },
        clientProfile: {
          type: SchemaType.OBJECT,
          properties: {
            clientCode: { type: SchemaType.STRING },
            age: { type: SchemaType.STRING },
            gender: { type: SchemaType.STRING },
            occupation: { type: SchemaType.STRING },
            chiefComplaint: { type: SchemaType.STRING },
            counselingMotivation: { type: SchemaType.STRING },
          },
        },
      },
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [inlineData, { text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const responseText = result.response.text();
    let parsedData = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      throw new Error("결과를 파싱하는데 실패했습니다.");
    }

    return NextResponse.json({ success: true, parsedData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
