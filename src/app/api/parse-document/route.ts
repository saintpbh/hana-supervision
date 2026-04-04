import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileData, fileText, mimeType, aiInstructions, target = "admin" } = body;

    const customModel = aiInstructions?.model || "gemini-2.0-flash";

    let prompt = "";
    let responseSchema: Schema = { type: SchemaType.OBJECT, properties: {} };

    if (target === "admin") {
      prompt = `첨부된 문서는 상담 내담자의 기본 정보, 내담 기록 또는 행정 정보입니다.
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

      responseSchema = {
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
    } else if (target === "sct") {
      prompt = `첨부된 문서는 SCT (문장완성검사) 결과입니다.
문서에서 사용자가 응답한 문항 번호와 내용을 모두 추출해주세요. 그리고 종합적인 소견이나 분석 내용이 있다면 그것도 추출해주세요.`;
      
      responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
          sct: {
            type: SchemaType.OBJECT,
            properties: {
              answersArray: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    id: { type: SchemaType.STRING, description: "문항 번호 (예: 1, 2, 3)" },
                    answer: { type: SchemaType.STRING, description: "사용자의 답변 내용" }
                  }
                }
              },
              interpretation: { type: SchemaType.STRING, description: "결과지 상의 해석, 소견, 특이사항" }
            }
          }
        }
      };
    } else if (target === "mmpi2") {
      prompt = `첨부된 문서는 MMPI-2 심리검사 결과입니다.
문서에서 각 척도별 T점수 등의 점수를 추출하고, 문서에 명시된 코드 타입(Code Type)과 유의미한 상승 척도가 있다면 추출해주세요.`;
      
      responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
          mmpi2: {
            type: SchemaType.OBJECT,
            properties: {
              scalesArray: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    scaleId: { type: SchemaType.STRING, description: "척도 기호 (예: L, F, K, Hs, D, Hy, Pd 등)" },
                    score: { type: SchemaType.STRING, description: "해당 척도의 점수 (T점수 중심)" }
                  }
                }
              },
              codeType: { type: SchemaType.STRING, description: "결과지 상의 MMPI-2 코드 타입 (예: 2-7, 4-9 등)" },
              significantScales: { type: SchemaType.STRING, description: "유의미하게 상승했다고 언급된 척도들이나 전반적 해석 요약" }
            }
          }
        }
      };
    } else if (target === "tci") {
      prompt = `첨부된 문서는 TCI (기질 및 성격 검사) 결과입니다.
각 항목별 점수(백분위 등)를 기질(NS, HA, RD, P)과 성격(SD, C, ST) 차원에서 추출해주세요.`;
      
      responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
          tci: {
            type: SchemaType.OBJECT,
            properties: {
              noveltySeekingNS: { type: SchemaType.STRING, description: "자극추구(NS) 점수 또는 백분위" },
              harmAvoidanceHA: { type: SchemaType.STRING, description: "위험회피(HA) 점수 또는 백분위" },
              rewardDependenceRD: { type: SchemaType.STRING, description: "보상의존성(RD) 점수 또는 백분위" },
              persistenceP: { type: SchemaType.STRING, description: "인내력(P) 점수 또는 백분위" },
              selfDirectednessSD: { type: SchemaType.STRING, description: "자율성(SD) 점수 또는 백분위" },
              cooperativenessC: { type: SchemaType.STRING, description: "연대감(C) 점수 또는 백분위" },
              selfTranscendenceST: { type: SchemaType.STRING, description: "자기초월(ST) 점수 또는 백분위" },
            }
          }
        }
      };
    }

    const instructionAppend = "\n\n중요: 반드시 순수 JSON 객체 포맷으로만 응답하세요. ```json 등의 마크다운 백틱도 포함하지 마세요.";
    prompt += instructionAppend;

    let responseText = "";

    if (customModel.startsWith("gpt-")) {
      const key = aiInstructions?.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OpenAI API 키가 없습니다.");
      const openai = new OpenAI({ apiKey: key });

      const contentArr: any[] = [{ type: "text", text: prompt }];
      if (fileText) {
        contentArr.push({ type: "text", text: `[문서 첨부]\n${fileText}` });
      } else if (fileData) {
        let cleanBase64 = fileData;
        if (fileData.includes(",")) cleanBase64 = fileData.split(",")[1];
        if (mimeType === 'application/pdf') {
          throw new Error("현재 선택하신 모델(ChatGPT)은 PDF 직접 이미지 파싱을 즉시 지원하지 않습니다. 텍스트로 변환해 올리거나 다른 AI 모델을 선택해주세요.");
        } else {
          contentArr.push({ type: "image_url", image_url: { url: `data:${mimeType || 'image/png'};base64,${cleanBase64}` } });
        }
      }

      const response = await openai.chat.completions.create({
        model: customModel,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: contentArr }]
      });
      responseText = response.choices[0]?.message?.content || "{}";

    } else if (customModel.startsWith("claude-")) {
      const key = aiInstructions?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("Anthropic API 키가 없습니다.");
      const anthropic = new Anthropic({ apiKey: key });

      const contentArr: any[] = [{ type: "text", text: prompt }];
      if (fileText) {
        contentArr.push({ type: "text", text: `[문서 첨부]\n${fileText}` });
      } else if (fileData) {
        let cleanBase64 = fileData;
        if (fileData.includes(",")) cleanBase64 = fileData.split(",")[1];
        if (mimeType === 'application/pdf') {
          contentArr.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: cleanBase64 }
          });
        } else {
          contentArr.push({
            type: "image",
            source: { type: "base64", media_type: mimeType || "image/png", data: cleanBase64 }
          });
        }
      }

      const response = await anthropic.messages.create({
        model: customModel,
        max_tokens: 4096,
        messages: [{ role: "user", content: contentArr }]
      });
      // @ts-expect-error message content
      responseText = response.content[0]?.text || "{}";
      
    } else {
      const key = aiInstructions?.apiKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Gemini API 키가 없습니다.");
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: customModel });

      const parts: any[] = [{ text: prompt }];
      if (fileText) {
        parts.push({ text: `\n\n[문서 첨부 내용 시작]\n${fileText}\n[문서 첨부 내용 끝]\n` });
      } else if (fileData) {
        let cleanBase64 = fileData;
        if (fileData.includes(",")) {
          cleanBase64 = fileData.split(",")[1];
        }
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || "application/pdf",
          },
        });
      }

      const result = await model.generateContent({
        contents: [{ role: "user", parts: parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });
      responseText = result.response.text();
    }

    let parsedData: Record<string, any> = {};
    try {
      parsedData = JSON.parse(responseText);
      
      // Post-process the arrays into Record<string, string> for frontend compatibility
      if (target === "sct" && parsedData.sct?.answersArray) {
        const mappedAnswers: Record<string, string> = {};
        for (const item of parsedData.sct.answersArray) {
          mappedAnswers[item.id] = item.answer;
        }
        parsedData.sct.answers = mappedAnswers;
        delete parsedData.sct.answersArray;
      }
      
      if (target === "mmpi2" && parsedData.mmpi2?.scalesArray) {
        const mappedScales: Record<string, string> = {};
        for (const item of parsedData.mmpi2.scalesArray) {
          mappedScales[item.scaleId] = item.score;
        }
        parsedData.mmpi2.scales = mappedScales;
        delete parsedData.mmpi2.scalesArray;
      }

    } catch {
      throw new Error("결과를 파싱하는데 실패했습니다.");
    }

    return NextResponse.json({ success: true, parsedData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
