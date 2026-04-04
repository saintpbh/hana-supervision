import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ReportFormData } from "@/types/report";
import { THEORY_LABELS } from "@/types/report";
import { SCT_QUESTIONS, MMPI2_SCALES } from "@/constants/report";

function formatSCT(answers: Record<string, string>): string {
  if (!answers || Object.keys(answers).length === 0) return "작성되지 않음";
  
  let formatted = "";
  for (const section of SCT_QUESTIONS) {
    let sectionData = "";
    for (const item of section.items) {
      const val = answers[item.id];
      if (val && val.trim()) {
        sectionData += `  - ${item.id}. ${item.text}: ${val}\n`;
      }
    }
    if (sectionData) {
      formatted += `- ${section.category}\n${sectionData}`;
    }
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
      if (val && val.trim()) {
        sectionData.push(`${scale}=${val}`);
      }
    }
    if (sectionData.length > 0) {
      formatted += `- ${section.category}: ${sectionData.join(", ")}\n`;
    }
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

function buildPrompt(data: ReportFormData, ai: AIInstructionsInput | null): string {
  const role = ai?.rolePersona || "한국심리학회 기준 1급 상담심리사이자 10년 이상의 임상 경력을 가진 '전문 상담 슈퍼바이저'입니다.";
  const theory = ai?.counselingTheory || "전문 진단 및 일반 심리상담 이론";
  
  const sctFormatted = formatSCT(data.testData.sct.answers);
  const mmpiFormatted = formatMMPI(data.testData.mmpi2.scales);

  return `당신은 ${role}
당신은 다음의 [인공지능 지침]을 최우선으로 숙지한 후, 제공되는 상담 맥락과 심리분석 결과를 해석해야 합니다.

## [인공지능 지침]
- 중점 적용 상담 이론: **${theory}**
- 사례 개념화 및 분석 방향: ${ai?.direction || "제공되지 않음"}
- 축어록 요약 방향: ${ai?.transcriptDirection || "제공되지 않음"}
- 추가 커스텀 지시사항: ${ai?.customPrompt || "제공되지 않음"}

==================================================
아래의 내담자 정보와 상담 내역을 먼저 읽고 내담자의 상황과 맥락을 이해하세요.

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

==================================================
내담자의 맥락이 이해되었다면, 다음 심리검사 데이터를 확인하고 앞서 제시된 [인공지능 지침]에 근거하여 심도 있게 해석하세요.

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

==================================================
위의 모든 정보를 종합하여 아래 **슈퍼비전 보고서 표준 양식**을 완성하세요.

## 슈퍼비전 보고서 표준 양식 (다음 섹션을 반드시 포함하고 순서를 준수하세요)

### 1. 표지 및 행정 정보
(상담자: ${data.adminInfo.counselorName}, 소속: ${data.adminInfo.organization}, 슈퍼바이저: ${data.adminInfo.supervisorName}, 일시: ${data.adminInfo.sessionDate}, 장소: ${data.adminInfo.location})

### 2. 내담자 정보 및 주 호소 문제 요약
(제공된 내담자 기본 정보를 간략히 요약)

### 3. 상담 내용 및 회기 요약 
(제공된 상담 과정 요약 데이터를 보고서 형식으로 세련되게 정리. 축어록 요약 방향 지침을 적용하세요.)

### 4. 심리검사 결과 및 깊이 있는 해석
([인공지능 지침]의 방향성과 선택된 이론(${theory})을 적용하여 SCT, MMPI-2, TCI의 결과를 서로 교차-해석하세요.)

### 5. 사례개념화 (Case Conceptualization)
(선택된 이론별로 소제목을 달아 개별적인 사례개념화를 작성하세요. 다음 요소를 꼭 포함하세요: 핵심 감정/갈등, 방어기제/대처, 대인관계 패턴, 발달사적 관점)

### 6. 슈퍼바이저 피드백 및 치료적 제안
(상담자의 '슈퍼비전 요청사항'에 대한 답변을 포함하여, 구체적인 치료 방향성을 제안하세요.)

---
## 출력 형식 지침
- Markdown 형식으로 출력하세요. (제목은 ## 또는 ### 사용)
- 객관적 사실과 전문적 해석을 명확히 구분하여 기술하세요.
- 한국어로 작성하세요. 전문 용어에는 괄호 안에 영문 원어를 병기하세요.
- 결과물에 [인공지능 지침]이라는 텍스트가 노골적으로 드러나지 않도록, 내용에 자연스럽게 녹여내세요.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formData: ReportFormData = body.data || body;
    const aiInstructions: AIInstructionsInput | null = body.aiInstructions || null;
    const prompt = buildPrompt(formData, aiInstructions);

    if (aiInstructions?.orchestrationMode === "multi") {
      // ===== MULTI-AGENT PIPELINE =====
      // 1. Gemini: Data Parsing & Emotion Extraction
      const geminiKey = aiInstructions?.apiKey || process.env.GEMINI_API_KEY;
      const openaiKey = aiInstructions?.openaiApiKey || process.env.OPENAI_API_KEY;
      const claudeKey = aiInstructions?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

      if (!geminiKey || !openaiKey || !claudeKey) {
        throw new Error("멀티 에이전트 모드를 사용하려면 Gemini, OpenAI, Claude API 키가 모두 설정되어야 합니다.");
      }

      const tokens = {
        gemini: { prompt: 0, completion: 0 },
        openai: { prompt: 0, completion: 0 },
        claude: { prompt: 0, completion: 0 },
      };

      // Step 1: Gemini
      const genAI = new GoogleGenerativeAI(geminiKey);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const step1Prompt = `이 심리검사 데이터를 읽고 내담자의 핵심 감정단어, 방어기제 양상, 호소 문제의 이면을 500자 내외로 빠르게 파싱하여 요약해. \n\n데이터:\n${prompt}`;
      const geminiRes = await geminiModel.generateContent(step1Prompt);
      const step1Text = geminiRes.response.text();
      tokens.gemini.prompt = geminiRes.response.usageMetadata?.promptTokenCount || 0;
      tokens.gemini.completion = geminiRes.response.usageMetadata?.candidatesTokenCount || 0;

      // Step 2: OpenAI (GPT-4o / GPT-4o-mini)
      const openai = new OpenAI({ apiKey: openaiKey });
      const step2Prompt = `당신은 정신과 전문의이자 임상심리전문가야. 다음 Gemini가 1차 파싱한 내담자 핵심 요약과, 원본 내담자 정보를 바탕으로 DSM-5 기반의 철저한 진단 소견과 이론(CBT, 대상관계 등)에 기반한 심층 사례개념화 초안을 작성해.\n\n[1차 추출 요약]\n${step1Text}\n\n[원본 지침 및 데이터]\n${prompt}`;
      const gptRes = await openai.chat.completions.create({
        model: "gpt-4o-mini", // fallback to mini for speed, logic is still good
        messages: [{ role: "user", content: step2Prompt }]
      });
      const step2Text = gptRes.choices[0]?.message?.content || "";
      tokens.openai.prompt = gptRes.usage?.prompt_tokens || 0;
      tokens.openai.completion = gptRes.usage?.completion_tokens || 0;

      // Step 3: Claude (Sonnet 3.5)
      const anthropic = new Anthropic({ apiKey: claudeKey });
      const step3Prompt = `당신은 공감적이고 능숙한 수석 전문상담사. 다음 2단계의 이론적 진단 초안(GPT 생성)과 원본 데이터를 종합하여, 최종 '슈퍼비전 보고서 마크다운 양식'을 완벽하게 완성해줘. 기계적이지 않게 인간적이고 서술적으로 유려하게 작성해야 해. 반드시 요구된 출력 형식 지침과 마크다운 양식을 엄격히 지켜.\n\n[2단계 오케스트레이션 결과]\n${step2Text}\n\n[원본 지침 및 데이터]\n${prompt}`;
      const claudeRes = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        messages: [{ role: "user", content: step3Prompt }]
      });
      // @ts-expect-error content types
      const step3Text = claudeRes.content[0]?.text || "";
      tokens.claude.prompt = claudeRes.usage.input_tokens || 0;
      tokens.claude.completion = claudeRes.usage.output_tokens || 0;

      return NextResponse.json({ report: step3Text, usage: tokens, mode: "multi" });

    } else if (aiInstructions?.orchestrationMode === "gemini-multi") {
      // ===== SINGLE AI (GEMINI) MULTI-AGENT PIPELINE =====
      const geminiKey = aiInstructions?.apiKey || process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error("싱글 AI 오케스트레이션 모드를 사용하려면 Gemini API 키가 설정되어야 합니다.");
      }

      const customModel = aiInstructions?.model || "gemini-3.1-pro-preview";

      const tokens = {
        gemini: { prompt: 0, completion: 0 }
      };

      const genAI = new GoogleGenerativeAI(geminiKey);

      // Step 1: Data Parser (Gemini 2.5 Flash for speed)
      const parserModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const step1Prompt = `이 심리검사 데이터를 읽고 내담자의 핵심 감정단어, 방어기제 양상, 호소 문제의 이면을 500자 내외로 빠르게 파싱하여 요약해. \n\n데이터:\n${prompt}`;
      const geminiRes1 = await parserModel.generateContent(step1Prompt);
      const step1Text = geminiRes1.response.text();
      tokens.gemini.prompt += geminiRes1.response.usageMetadata?.promptTokenCount || 0;
      tokens.gemini.completion += geminiRes1.response.usageMetadata?.candidatesTokenCount || 0;

      // Step 2: Clinical Diagnostician (User Selected Model)
      const diagModel = genAI.getGenerativeModel({ model: customModel });
      const step2Prompt = `당신은 정신과 전문의이자 임상심리전문가야. 다음 1차 파싱된 요약과 원본 데이터를 바탕으로 DSM-5 기반의 철저한 진단 소견과 심층 사례개념화 초안을 논리적으로 작성해.\n\n[1차 추출 요약]\n${step1Text}\n\n[원본 지침 및 데이터]\n${prompt}`;
      const geminiRes2 = await diagModel.generateContent(step2Prompt);
      const step2Text = geminiRes2.response.text();
      tokens.gemini.prompt += geminiRes2.response.usageMetadata?.promptTokenCount || 0;
      tokens.gemini.completion += geminiRes2.response.usageMetadata?.candidatesTokenCount || 0;

      // Step 3: Senior Supervisor / Editor (User Selected Model)
      const editorModel = genAI.getGenerativeModel({ model: customModel });
      const step3Prompt = `당신은 공감적이고 능숙한 수석 전문상담사. 2단계의 이론적 진단 초안과 원본 데이터를 종합하여, 최종 '슈퍼비전 보고서 마크다운 양식'을 완벽하게 완성해줘. 기계적이지 않게 인간적이고 서술적으로 유려하게 작성해야 해. 반드시 요구된 출력 형식 지침과 마크다운 양식을 엄격히 지켜.\n\n[2단계 오케스트레이션 결과]\n${step2Text}\n\n[원본 지침 및 데이터]\n${prompt}`;
      const geminiRes3 = await editorModel.generateContent(step3Prompt);
      const step3Text = geminiRes3.response.text();
      tokens.gemini.prompt += geminiRes3.response.usageMetadata?.promptTokenCount || 0;
      tokens.gemini.completion += geminiRes3.response.usageMetadata?.candidatesTokenCount || 0;

      return NextResponse.json({ report: step3Text, usage: tokens, mode: "gemini-multi" });

    } else {
      // ===== SINGLE AGENT PIPELINE =====
      const customModel = aiInstructions?.model || "gemini-2.0-flash";
      let text = "";
      const tokenUsage = { prompt: 0, completion: 0 };

      if (customModel.startsWith("gpt-")) {
        const key = aiInstructions?.openaiApiKey || process.env.OPENAI_API_KEY;
        if (!key) throw new Error("OpenAI API 키가 설정되지 않았습니다.");
        const openai = new OpenAI({ apiKey: key });
        const response = await openai.chat.completions.create({
          model: customModel,
          messages: [{ role: "user", content: prompt }]
        });
        text = response.choices[0]?.message?.content || "";
        tokenUsage.prompt = response.usage?.prompt_tokens || 0;
        tokenUsage.completion = response.usage?.completion_tokens || 0;
      } else if (customModel.startsWith("claude-")) {
        const key = aiInstructions?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) throw new Error("Anthropic API 키가 설정되지 않았습니다.");
        const anthropic = new Anthropic({ apiKey: key });
        const response = await anthropic.messages.create({
          model: customModel,
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }]
        });
        // @ts-expect-error content types
        text = response.content[0]?.text || "";
        tokenUsage.prompt = response.usage.input_tokens || 0;
        tokenUsage.completion = response.usage.output_tokens || 0;
      } else {
        const key = aiInstructions?.apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("Gemini API 키가 설정되지 않았습니다.");
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: customModel });
        const result = await model.generateContent(prompt);
        text = result.response.text();
        tokenUsage.prompt = result.response.usageMetadata?.promptTokenCount || 0;
        tokenUsage.completion = result.response.usageMetadata?.candidatesTokenCount || 0;
      }

      return NextResponse.json({ report: text, usage: tokenUsage, mode: "single" });
    }
  } catch (err: unknown) {
    console.error("Report generation error:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
