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
  score?: number;
};

export type AcademyState = {
  access: "locked" | "pending" | "granted";
  grantedAt?: string;
  completedDays: number[];
  activeDay: number;
  lastCompletedAt?: string;
};

export type PersistedAppState = {
  assessment: AssessmentState;
  academy: AcademyState;
};

