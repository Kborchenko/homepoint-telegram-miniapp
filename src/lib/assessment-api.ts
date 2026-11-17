import { getTelegramInitData } from "@/lib/telegram";

export type ServerAssessment = {
  attempt: number;
  status: "idle" | "active" | "completed" | "expired";
  startedAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

async function requestAssessment(action: "status" | "start" | "complete"): Promise<ServerAssessment | null> {
  const initData = getTelegramInitData();
  if (!apiBaseUrl || !initData) return null;

  const response = await fetch(`${apiBaseUrl}/api/primary-assessment/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  const payload = await response.json().catch(() => null) as { assessment?: ServerAssessment; error?: string } | null;
  if (!response.ok || !payload?.assessment) throw new Error(payload?.error ?? "Не удалось обновить первичный тест");
  return payload.assessment;
}

export const readPrimaryAssessment = () => requestAssessment("status");
export const startPrimaryAssessment = () => requestAssessment("start");
export const completePrimaryAssessment = () => requestAssessment("complete");
