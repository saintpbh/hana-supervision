/* ── Counseling theory enum ── */
export type CounselingTheory =
  | "psychodynamic"    // 정신역동
  | "object_relations" // 대상관계
  | "cbt"              // 인지행동치료
  | "act";             // 수용전념치료

export const THEORY_LABELS: Record<CounselingTheory, string> = {
  psychodynamic: "정신역동",
  object_relations: "대상관계",
  cbt: "인지행동치료 (CBT)",
  act: "수용전념치료 (ACT)",
};

export const THEORY_DESCRIPTIONS: Record<CounselingTheory, string> = {
  psychodynamic: "무의식적 갈등, 방어기제, 전이/역전이 분석 중심",
  object_relations: "초기 대상관계, 내적 작업모델, 분리-개별화 중심",
  cbt: "인지적 왜곡, 자동적 사고, 행동 패턴 분석 중심",
  act: "심리적 유연성, 수용, 가치 기반 행동 분석 중심",
};

/* ── Step 1: Administrative Info ── */
export interface AdminInfo {
  counselorName: string;
  organization: string;
  supervisorName: string;
  sessionDate: string;
  location: string;
}

/* ── Step 2: Client Profile ── */
export interface ClientProfile {
  clientCode: string;
  age: string;
  gender: string;
  occupation: string;
  chiefComplaint: string;
  counselingMotivation: string;
}

/* ── Step 3: Psychological Test Data ── */
export interface SCTResult {
  answers: Record<string, string>;
  interpretation: string; // 주요 해석 포인트
}

export interface MMPI2Result {
  scales: Record<string, string>;
  codeType: string;        // 코드 타입
  significantScales: string; // 유의미한 상승 척도
}

export interface TCIResult {
  noveltySeekingNS: string;
  harmAvoidanceHA: string;
  rewardDependenceRD: string;
  persistenceP: string;
  selfDirectednessSD: string;
  cooperativenessC: string;
  selfTranscendenceST: string;
}

export interface TestData {
  sct: SCTResult;
  mmpi2: MMPI2Result;
  tci: TCIResult;
}

/* ── Step 4: Session Summary ── */
export interface SessionSummary {
  sessionNumber: string;
  sessionDate: string;
  sessionContent: string;   // 주요 상담 내용 요약
  keyTranscripts: string;   // 핵심 축어록
  counselorObservation: string; // 상담자 소견
  supervisionRequest: string;   // 슈퍼비전 요청사항
}

/* ── Full form data ── */
export interface ReportFormData {
  adminInfo: AdminInfo;
  clientProfile: ClientProfile;
  testData: TestData;
  sessionSummary: SessionSummary;
}

/* ── Initial empty state ── */
export const INITIAL_FORM_DATA: ReportFormData = {
  adminInfo: {
    counselorName: "",
    organization: "",
    supervisorName: "",
    sessionDate: "",
    location: "",
  },
  clientProfile: {
    clientCode: "",
    age: "",
    gender: "",
    occupation: "",
    chiefComplaint: "",
    counselingMotivation: "",
  },
  testData: {
    sct: {
      answers: {},
      interpretation: "",
    },
    mmpi2: {
      scales: {},
      codeType: "",
      significantScales: "",
    },
    tci: {
      noveltySeekingNS: "",
      harmAvoidanceHA: "",
      rewardDependenceRD: "",
      persistenceP: "",
      selfDirectednessSD: "",
      cooperativenessC: "",
      selfTranscendenceST: "",
    },
  },
  sessionSummary: {
    sessionNumber: "",
    sessionDate: "",
    sessionContent: "",
    keyTranscripts: "",
    counselorObservation: "",
    supervisionRequest: "",
  },
};
