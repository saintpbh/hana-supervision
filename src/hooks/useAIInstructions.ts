import { useState, useCallback, useEffect } from "react";
import { CounselingTheory } from "@/types/report";

export interface AIInstructions {
  apiKey: string;
  model: string;
  selectedTheories: CounselingTheory[];
  direction: string;
  transcriptDirection: string;
  customPrompt: string;
}

export const DEFAULT_AI_INSTRUCTIONS: AIInstructions = {
  apiKey: "",
  model: "gemini-2.0-flash",
  selectedTheories: [],
  direction: "",
  transcriptDirection: "",
  customPrompt: "",
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
