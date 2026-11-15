export type AppSection = "home" | "test" | "academy" | "library" | "profile";

export type CandidateProfile = {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
};

export type AssessmentState = {
  status: "idle" | "active" | "completed" | "expired";
  startedAt?: string;
  expiresAt?: string;
  answers: Record<string, string>;
  completedBlocks: number[];
  finalStarted?: boolean;
  completedAt?: string;
  score?: number;
};

export type DayProgress = {
  quizAnswers: Record<string, string>;
  quizScore?: number;
  simulationStep: number;
  simulationScore: number;
};

export type AcademyState = {
  access: "locked" | "pending" | "granted";
  grantedAt?: string;
  completedDays: number[];
  activeDay: number;
  lastCompletedAt?: string;
  dayProgress: Record<string, DayProgress>;
};

export type PersistedAppState = {
  assessment: AssessmentState;
  academy: AcademyState;
};

