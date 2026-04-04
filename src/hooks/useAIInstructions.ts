import { useState, useCallback, useEffect } from "react";
import { CounselingTheory } from "@/types/report";

export interface AIInstructions {
  apiKey: string; // Gemini
  openaiApiKey: string;
  anthropicApiKey: string;
  model: string;
  selectedTheories: CounselingTheory[];
  direction: string;
  transcriptDirection: string;
  customPrompt: string;
  orchestrationMode: "single" | "multi";
}

export const DEFAULT_AI_INSTRUCTIONS: AIInstructions = {
  apiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  model: "gemini-2.0-flash",
  selectedTheories: ["object_relations", "cbt"],
  direction: "내담자의 핵심 신념(Core Beliefs)과 방어기제를 깊이 있게 식별하고, 상담 내용의 표면적 의미를 넘어선 임상적 통찰을 제공해 주세요. 단정적 어투(~이다)보다는 가설적 어투(~일 수 있다, ~로 보입니다)를 지향하십시오.",
  transcriptDirection: "상담자의 공감적 반응, 반영 기법의 적절성 및 내담자의 비언어적 뉘앙스 변화에 주목하여 분석해 주세요.",
  customPrompt: "평가 시, 각 심리검사 지표들 간의 모순점이나 연관성을 적극적으로 교차 해석해야 합니다.",
  orchestrationMode: "single",
};

function loadFromStorage(): AIInstructions {
  if (typeof window === "undefined") return DEFAULT_AI_INSTRUCTIONS;
  try {
    const stored = localStorage.getItem("hana_ai_instructions");
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_AI_INSTRUCTIONS, ...parsed };
    }
  } catch (err) {
    console.error("Failed to load AI instructions", err);
  }
  return DEFAULT_AI_INSTRUCTIONS;
}

export function useAIInstructions() {
  const [instructions, setInstructions] = useState<AIInstructions>(DEFAULT_AI_INSTRUCTIONS);

  useEffect(() => {
    setInstructions(loadFromStorage());
  }, []);

  const saveInstructions = useCallback((newInstructions: AIInstructions) => {
    setInstructions(newInstructions);
    localStorage.setItem("hana_ai_instructions", JSON.stringify(newInstructions));
    window.dispatchEvent(new Event("ai-instructions-updated"));
  }, []);

  return { instructions, saveInstructions };
}
