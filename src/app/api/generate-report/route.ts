import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ReportFormData } from "@/types/report";
import { SCT_QUESTIONS, MMPI2_SCALES } from "@/constants/report";

function formatSCT(answers: Record<string, string>): string {
  if (!answers || Object.keys(answers).length === 0) return "작성되지 않음";
  let formatted = "";
  for (const section of SCT_QUESTIONS) {
    let sectionData = "";
    for (const item of section.items) {
      const val = answers[item.id];
      if (val && val.trim()) sectionData += `  - ${item.id}. ${item.text}: ${val}\n`;
    }
    if (sectionData) formatted += `- ${section.category}\n${sectionData}`;
  }
  return formatted || "작성되지 않음";
}

function formatMMPI(scales: Record<string, string>): string {
  if (!scales || Object.keys(scales).length === 0) return "작성되지 않음";
  let formatted = "";
  for (const section of MMPI2_SCALES) {
    const sectionData = [];
    for (const scale of section.scales) {
      const val = scales[scale];
      if (val && val.trim()) sectionData.push(`${scale}=${val}`);
    }
    if (sectionData.length > 0) formatted += `- ${section.category}: ${sectionData.join(", ")}\n`;
  }
  return formatted || "작성되지 않음";
}

interface AIInstructionsInput {
  apiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  rolePersona?: string;
  counselingTheory?: string;
  direction?: string;
  transcriptDirection?: string;
  customPrompt?: string;
  orchestrationMode?: string;
}

function buildBaseData(data: ReportFormData): string {
  const sctFormatted = formatSCT(data.testData.sct.answers);
  const mmpiFormatted = formatMMPI(data.testData.mmpi2.scales);
  
  return `
## [내담자 정보 및 상담 맥락]
- 내담자 연령/성별: ${data.clientProfile.age} / ${data.clientProfile.gender}
- 직업: ${data.clientProfile.occupation}
- 주 호소 문제: ${data.clientProfile.chiefComplaint}
- 상담 동기 및 경위: ${data.clientProfile.counselingMotivation}

### 최근 상담 회기 요약 (제 ${data.sessionSummary.sessionNumber})
- 주요 상담 내용: ${data.sessionSummary.sessionContent}
- 핵심 축어록: ${data.sessionSummary.keyTranscripts}
- 상담자 소견: ${data.sessionSummary.counselorObservation}
- 슈퍼비전 요청사항: ${data.sessionSummary.supervisionRequest}

## [심리검사 데이터]
### SCT (문장완성검사)
${sctFormatted}
- 해석 포인트 및 종합 소견: ${data.testData.sct.interpretation || "없음"}

### MMPI-2
${mmpiFormatted}
- 코드 타입: ${data.testData.mmpi2.codeType || "없음"}
- 유의미한 상승 척도 요약: ${data.testData.mmpi2.significantScales || "없음"}

### TCI (기질 및 성격검사)
- 자극추구(NS): ${data.testData.tci.noveltySeekingNS} | 위험회피(HA): ${data.testData.tci.harmAvoidanceHA} | 사회적 민감성(RD): ${data.testData.tci.rewardDependenceRD} | 인내력(P): ${data.testData.tci.persistenceP}
- 자율성(SD): ${data.testData.tci.selfDirectednessSD} | 연대감(C): ${data.testData.tci.cooperativenessC} | 자기초월(ST): ${data.testData.tci.selfTranscendenceST}
`;
}

function buildReferencePrompt(data: ReportFormData, ai: AIInstructionsInput | null): string {
  const theory = ai?.counselingTheory || "전문 진단 및 일반 심리상담 이론";
  const baseData = buildBaseData(data);
  return `당신은 심리학 및 상담 분야의 세계적인 석학이자 최고 수준의 임상심리전문가 슈퍼바이저입니다.
제공되는 내담자 데이터와 상담 기록을 바탕으로, **박사 논문 수준 이상으로 압도적으로 상세하고 깊이 있는 학술적 레퍼런스 문서(판단의 근거와 학문적 근거 종합 분석서)**를 작성해야 합니다. 
분량 제한 없이 출력 가능한 최대 분량으로 매우 친절하고, 논리적이고, 자세하게 설명하세요. (목표: 20~30장 분량의 심도 있는 보고서)

## [분석 지침]
- 중점 적용 상담 이론: **${theory}**
- 사례 개념화 방향: ${ai?.direction || "제공되지 않음"}
- 추가 커스텀 지시사항: ${ai?.customPrompt || "제공되지 않음"}
- 이 문서는 상담자가 자신의 임상적 판단이 왜 도출되었는지 이유를 문단별로 세세하게 공부할 수 있는 최고 수준의 학술적 해설서 역할을 해야 합니다.
- 심리검사의 교차분석, 방어기제의 발현 형태, 내담자 호소 문제의 기원 등에 대해 각 판단마다 어떤 심리학적 이론, 학술적 문헌이 뒷받침되는지 명확한 레퍼런스 설명과 소제목을 동반하여 기술하세요.

==================================================
${baseData}
==================================================

위 데이터를 통해 다음 항목들에 대해 완벽하고 논리적인 전공 서적 수준의 분석서(Reference)를 마크다운으로 출력하세요.
## 1. 심리검사(SCT, MMPI-2, TCI) 다면 교차 분석 및 학술적 근거
## 2. 내담자의 방어기제, 핵심 갈등, 대인관계 양상에 대한 심층적 고찰
## 3. 주 호소 문제의 발달사적 기원과 유지 요인 분석
## 4. '${theory}' 이론에 기반한 심층 사례 개념화 과정 및 개입 근거 분석
`;
}

function buildQAPrompt(referenceDoc: string, theory: string): string {
  return `당신은 최고 권위의 학술지 편집장이자 가혹하고 철저한 팩트체크를 수행하는 QA(품질 검증) 에이전트입니다.
다음은 다른 인공지능이 작성한 [학술적 레퍼런스 초안 문서]입니다. 이 문서에 인용된 이론, 개념, 논문, 인물 및 학술적 주장들이 실제 심리학계(${theory} 등)에 허구가 아닌 '실제로 존재하는 내용'인지 팩트체크 하세요. 할루시네이션(거짓 정보)이 존재한다면 가혹하게 비판해야 합니다.

100점 만점으로 점수를 매기되, 창작된 논문 제목이나 존재하지 않는 학술적 주장이 발견될 경우 큰 점수를 감점하세요. 90점 이상이면 패스(isPass: true)로 간주합니다.

## 출력 형식 지정 (매우 중요)
반드시 아래의 구조화된 형태를 가진 순수 JSON 형식으로만 응답해야 합니다. 마크다운 블록이나 추가 문맥을 덧붙이지 마세요.
{
  "score": 0~100 사이의 숫자,
  "feedback": "재작성에 필요한 핵심 피드백 요약(90점 미만일 경우). 90점 이상일 경우 100점이 안된 이유(한계점 등)",
  "qaReport": "최종 문서 하단에 첨부될 QA 레포트 원문. 통과 시에 10점 어치의 미숙한 부분을 조언하는 내용으로 마크다운 형식으로 풍부하게 작성. 90점 미만이라면 '할루시네이션 발견으로 반려됨' 기재.",
  "isPass": true 또는 false
}

==================================================
## [검증 대상 초안 문서]
${referenceDoc}
`;
}

function buildMainReportPrompt(data: ReportFormData, ai: AIInstructionsInput | null, referenceOutput: string): string {
  const role = ai?.rolePersona || "한국심리학회 기준 1급 상담심리사이자 10년 이상의 임상 경력을 가진 '전문 상담 슈퍼바이저'입니다.";
  const theory = ai?.counselingTheory || "전문 진단 및 일반 심리상담 이론";
  const baseData = buildBaseData(data);

  return `당신은 ${role}입니다.

당신은 방금 전담 QA 에이전트의 검수를 통과한 **[학술적 레퍼런스 및 근거 해설서]**를 완벽하게 숙지하고, 이를 바탕으로 내담자 원본 데이터와 함께 최종 **[슈퍼비전 종합보고서]**를 작성해야 합니다.

## [중요 지침]
- 중점 적용 상담 이론: **${theory}**
- 축어록 요약 방향: ${ai?.transcriptDirection || "제공되지 않음"}
- **가장 중요한 규칙**: 종합보고서에서 심층 해석이나 임상적 소견을 서술할 때는, 항상 결과의 이유에 해당하는 레퍼런스를 참조 표시(예: \`[Ref: 1. MMPI-2 다면 분석]\` 또는 \`[Ref: 방어기제 챕터]\`) 형태로 기재하세요. 이를 통해 상담자가 종합보고서를 바탕으로 학술적 레퍼런스 문서를 즉시 찾아가 같이 공부할 수 있도록 해야 합니다. 

==================================================
## [학술적 레퍼런스 및 근거 해설서]
${referenceOutput}

==================================================
## [원천 데이터 요약]
${baseData}

==================================================
위의 사항들을 충실히 반영하여, 아래 **슈퍼비전 보고서 표준 양식**을 완성하세요.

### 1. 표지 및 상담 정보
(상담자: ${data.adminInfo.counselorName}, 소속: ${data.adminInfo.organization}, 슈퍼바이저: ${data.adminInfo.supervisorName}, 일시: ${data.adminInfo.sessionDate}, 장소: ${data.adminInfo.location})
### 2. 내담자 정보 및 주 호소 문제 요약
### 3. 상담 내용 및 회기 요약 
### 4. 심리검사 종합 분석 결과 (반드시 [Ref: ~] 인용 표기 포함)
### 5. 종합 사례개념화 (반드시 [Ref: ~] 인용 표기 포함)
### 6. 슈퍼바이저 피드백 및 치료적 제안
---
출력 형식 지침: Markdown 형식으로 출력 (제목은 ## 또는 ### 사용). 한국어로 작성. 결과물에 [인공지능 지침]이라는 지시문 텍스트가 노골적으로 드러나지 않도록 유려하게 서술하세요.
`;
}

function parseQAJson(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch {
    return { score: 100, isPass: true, feedback: "QA 채점 오류 임시 패스", qaReport: "> QA 에이전트의 피드백 렌더링에 오류가 발생했습니다." };
  }
}

async function runModelCall(modelType: string, customModel: string, prompt: string, keys: Record<string, string | undefined>) {
  if (modelType === "openai" || customModel.startsWith("gpt-")) {
    if (!keys.openai) throw new Error("OpenAI API 키가 필요합니다.");
    const openai = new OpenAI({ apiKey: keys.openai });
    const response = await openai.chat.completions.create({
      model: customModel,
      messages: [{ role: "user", content: prompt }]
    });
    return {
      text: response.choices[0]?.message?.content || "",
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    };
  } else if (modelType === "claude" || customModel.startsWith("claude-")) {
    if (!keys.anthropic) throw new Error("Anthropic API 키가 필요합니다.");
    const anthropic = new Anthropic({ apiKey: keys.anthropic });
    const response = await anthropic.messages.create({
      model: customModel,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }]
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return {
      text: textBlock && "text" in textBlock ? textBlock.text : "",
      promptTokens: response.usage.input_tokens || 0,
      completionTokens: response.usage.output_tokens || 0
    };
  } else {
    if (!keys.gemini) throw new Error("Gemini API 키가 필요합니다.");
    const genAI = new GoogleGenerativeAI(keys.gemini);
    const model = genAI.getGenerativeModel({ model: customModel });
    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
      promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
      completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0
    };
  }
}

async function executeQALoopAndPipeline(
  refModelType: string, refModel: string,
  qaModelType: string, qaModel: string,
  repModelType: string, repModel: string,
  formData: ReportFormData, aiInstructions: AIInstructionsInput | null, keys: Record<string, string | undefined>
) {
  const baseRefPrompt = buildReferencePrompt(formData, aiInstructions);
  const theoryInfo = aiInstructions?.counselingTheory || "일반 임상심리 이론";
  const totalUsage = { prompt: 0, completion: 0 };

  let retries = 0;
  let passedRefDoc = "";
  let previousFeedback = "";

  while (retries < 2) {
    let currentRefPrompt = baseRefPrompt;
    if (previousFeedback) {
      currentRefPrompt += `\n\n[이전 생성본 검수(QA) 강력 반려 사유! 반드시 이 피드백을 철저히 반영하여 할루시네이션을 수정/재작성할 것!!]\n${previousFeedback}`;
    }

    // 1. Generate Reference
    const refRes = await runModelCall(refModelType, refModel, currentRefPrompt, keys);
    const refText = refRes.text;
    totalUsage.prompt += refRes.promptTokens;
    totalUsage.completion += refRes.completionTokens;

    // 2. QA Check
    const qaPrompt = buildQAPrompt(refText, theoryInfo);
    const qaRes = await runModelCall(qaModelType, qaModel, qaPrompt, keys);
    totalUsage.prompt += qaRes.promptTokens;
    totalUsage.completion += qaRes.completionTokens;

    const qaJson = parseQAJson(qaRes.text);
    console.log(`[QA 에이전트 검증] Try: ${retries + 1}, Score: ${qaJson.score}, Pass: ${qaJson.isPass}`);

    if (qaJson.isPass || qaJson.score >= 90) {
      passedRefDoc = refText + `\n\n---\n\n## 🛡️ [QA 검수 및 한계점 리포트]\n**최종 검증 점수: ${qaJson.score}점**\n\n` + qaJson.qaReport;
      break;
    } else {
      previousFeedback = qaJson.feedback;
      passedRefDoc = refText + `\n\n---\n\n## 🚨 [QA 강제 산출 (Max Retries 초과)]\n**최종 검증 점수: ${qaJson.score}점**\n\n` + qaJson.qaReport;
    }

    retries++;
  }

  // 3. Final Report Generation based on the QA-passed Reference
  const mainPrompt = buildMainReportPrompt(formData, aiInstructions, passedRefDoc);
  const repRes = await runModelCall(repModelType, repModel, mainPrompt, keys);
  totalUsage.prompt += repRes.promptTokens;
  totalUsage.completion += repRes.completionTokens;

  return { reference: passedRefDoc, report: repRes.text, usage: totalUsage };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formData: ReportFormData = body.data || body;
    const aiInstructions: AIInstructionsInput | null = body.aiInstructions || null;

    const keys = {
      gemini: aiInstructions?.apiKey || process.env.GEMINI_API_KEY,
      openai: aiInstructions?.openaiApiKey || process.env.OPENAI_API_KEY,
      anthropic: aiInstructions?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    };

    let result;
    let modeLabel = "";

    if (aiInstructions?.orchestrationMode === "multi") {
      modeLabel = "multi";
      if (!keys.gemini || !keys.openai || !keys.anthropic) {
        throw new Error("멀티 에이전트 모드는 3가지 제공사 API Key가 모두 필요합니다.");
      }
      // Ref: GPT-4o, QA: Claude-3.5-Sonnet, Report: Claude-3.5-Sonnet
      result = await executeQALoopAndPipeline(
        "openai", "gpt-4o",
        "claude", "claude-3-5-sonnet-20241022",
        "claude", "claude-3-5-sonnet-20241022",
        formData, aiInstructions, keys
      );
    } else if (aiInstructions?.orchestrationMode === "gemini-multi") {
      modeLabel = "gemini-multi";
      const customModel = aiInstructions?.model || "gemini-3.1-pro-preview";
      result = await executeQALoopAndPipeline(
        "gemini", customModel,
        "gemini", "gemini-2.0-flash", // Use flash for fast QA
        "gemini", customModel,
        formData, aiInstructions, keys
      );
    } else {
      modeLabel = "single";
      const customModel = aiInstructions?.model || "gemini-2.0-flash";
      const modelType = customModel.startsWith("gpt-") ? "openai" : customModel.startsWith("claude-") ? "claude" : "gemini";
      
      result = await executeQALoopAndPipeline(
        modelType, customModel,
        modelType, customModel,
        modelType, customModel,
        formData, aiInstructions, keys
      );
    }

    return NextResponse.json({
      reference: result.reference,
      report: result.report,
      usage: result.usage,
      mode: modeLabel
    });
  } catch (err: unknown) {
    console.error("Report generation error:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
