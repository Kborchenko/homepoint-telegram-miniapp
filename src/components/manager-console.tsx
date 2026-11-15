"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock3, Search, ShieldCheck, UserRound, X } from "lucide-react";
import type { PersistedAppState } from "@/lib/types";

const STORAGE_KEY = "homepoint:candidate:v2";

const fallback: PersistedAppState = {
  assessment: { status: "completed", answers: {}, completedBlocks: [1, 2, 3, 4, 5, 6], score: 80 },
  academy: { access: "pending", completedDays: [], activeDay: 1, dayProgress: {} },
};

export default function ManagerConsole() {
  const [state, setState] = useState(fallback);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        if (value) setState(JSON.parse(value));
      } catch { /* demo fallback */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setAccess = (access: "granted" | "locked") => {
    const next = { ...state, academy: { ...state.academy, access, grantedAt: access === "granted" ? new Date().toISOString() : undefined } };
    setState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <main className="manager-shell">
      <header className="manager-header">
        <a href="../"><ArrowLeft /> В приложение</a>
        <div className="wordmark">HOME<span>POINT</span> <small>Manager</small></div>
        <span className="manager-avatar"><ShieldCheck /></span>
      </header>
      <section className="manager-intro">
        <div><p className="eyebrow">Кабинет менеджера</p><h1>Кандидаты<br />и доступы</h1><p>Результаты тестирования, запросы и обучение — в одном окне.</p></div>
        <div className="manager-totals"><div><b>1</b><span>новый запрос</span></div><div><b>1</b><span>кандидат</span></div></div>
      </section>
      <section className="manager-toolbar"><Search /><input aria-label="Найти кандидата" placeholder="Имя, username или Telegram ID" /><button>Фильтры</button></section>
      <section className="candidate-table">
        <div className="candidate-table__heading"><h2>Запросы доступа</h2><span>1</span></div>
        <article className="candidate-row">
          <span className="candidate-avatar"><UserRound /></span>
          <div className="candidate-main"><span className="request-badge"><Clock3 /> Ожидает решения</span><h3>Алексей Соколов</h3><p>@alexey_home · ID 742910</p><div className="candidate-score"><span>Первичный тест</span><b>{state.assessment.score ?? 0}%</b></div></div>
          <div className="candidate-actions">
            {state.academy.access === "granted" ? <button className="grant-state" type="button"><Check /> Доступ открыт</button> : <button className="grant-button" type="button" onClick={() => setAccess("granted")}><ShieldCheck /> Выдать доступ</button>}
            <button className="reject-button" type="button" onClick={() => setAccess("locked")}><X /> Закрыть</button>
          </div>
        </article>
      </section>
      <aside className="manager-note"><ShieldCheck /><div><b>В боевой версии</b><p>Менеджер авторизуется отдельно. Telegram ID кандидата, результат и выдача доступа фиксируются в Supabase и защищаются политиками доступа.</p></div></aside>
    </main>
  );
}

