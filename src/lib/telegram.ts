import type { CandidateProfile } from "./types";

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe?: { user?: TelegramUser };
  colorScheme?: "light" | "dark";
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const demoCandidate: CandidateProfile = {
  telegramId: "demo-742910",
  firstName: "Алексей",
  lastName: "Соколов",
  username: "alexey_home",
};

export function initTelegram(): CandidateProfile {
  const app = window.Telegram?.WebApp;
  app?.ready();
  app?.expand();
  app?.setHeaderColor?.("#f3efe5");
  app?.setBackgroundColor?.("#f3efe5");

  const user = app?.initDataUnsafe?.user;
  if (!user) return demoCandidate;
  return {
    telegramId: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: user.photo_url,
  };
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData ?? "";
}

