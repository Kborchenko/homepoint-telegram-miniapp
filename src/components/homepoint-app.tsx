"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  Library,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { assessmentQuestions, references, trainingDays } from "@/lib/content";
import { initTelegram } from "@/lib/telegram";
import type { AppSection, CandidateProfile, PersistedAppState } from "@/lib/types";

const STORAGE_KEY = "homepoint:candidate:v1";
const DAY = 24 * 60 * 60 * 1000;
const MOSCOW_TIME_ZONE = "Europe/Moscow";

const defaultState: PersistedAppState = {
  assessment: { status: "idle", answers: {} },
  academy: { access: "locked", completedDays: [], activeDay: 1 },
};

function readState(): PersistedAppState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    return { ...defaultState, ...JSON.parse(stored) } as PersistedAppState;
  } catch {
    return defaultState;
  }
}

function initials(profile: CandidateProfile) {
  return `${profile.firstName[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMoscow(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function moscowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function nextWorkdayMoscow(completedAt: string) {
  const start = new Date(completedAt);
  const source = moscowParts(start);
  let candidate = new Date(`${source.year}-${source.month}-${source.day}T21:00:00.000Z`);
  candidate = new Date(candidate.getTime() + DAY);
  while (["Sat", "Sun"].includes(moscowParts(candidate).weekday)) {
    candidate = new Date(candidate.getTime() + DAY);
  }
  return candidate;
}

function academyGate(state: PersistedAppState, day: number, now: Date) {
  if (state.academy.access !== "granted") return { open: false, label: "Нужен доступ" };
  if (state.academy.completedDays.includes(day)) return { open: true, label: "Пройден" };
  if (day === 1) return { open: true, label: "Доступен" };
  if (!state.academy.completedDays.includes(day - 1)) return { open: false, label: `После дня ${day - 1}` };
  if (!state.academy.lastCompletedAt) return { open: false, label: "Ожидает" };
  const unlockAt = nextWorkdayMoscow(state.academy.lastCompletedAt);
  if (now < unlockAt) return { open: false, label: `Откроется ${formatMoscow(unlockAt)}` };
  return { open: true, label: "Доступен" };
}

function Avatar({ profile, large = false }: { profile: CandidateProfile; large?: boolean }) {
  const style = profile.photoUrl ? { backgroundImage: `url(${profile.photoUrl})` } : undefined;
  return (
    <div
      className={`avatar ${large ? "avatar--large" : ""}`}
      style={style}
      role="img"
      aria-label={`Фото ${profile.firstName}`}
    >
      {!profile.photoUrl ? initials(profile) : null}
    </div>
  );
}

function TopBar({ profile }: { profile: CandidateProfile }) {
  return (
    <header className="topbar">
      <div className="wordmark" aria-label="HOMEPOINT">
        HOME<span>POINT</span>
      </div>
      <button className="profile-chip" type="button" aria-label="Открыть профиль">
        <span>
          <b>{profile.firstName}</b>
          <small>{profile.username ? `@${profile.username}` : "Кандидат"}</small>
        </span>
        <Avatar profile={profile} />
      </button>
    </header>
  );
}

function BottomNav({ active, onChange }: { active: AppSection; onChange: (section: AppSection) => void }) {
  const items = [
    ["home", Home, "Главная"],
    ["test", FileText, "Тест"],
    ["academy", GraduationCap, "Обучение"],
    ["library", Library, "База"],
    ["profile", UserRound, "Профиль"],
  ] as const;
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map(([id, Icon, label]) => (
        <button key={id} type="button" className={active === id ? "is-active" : ""} onClick={() => onChange(id)}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

function PrimaryButton({ children, onClick, disabled = false, tone = "green" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "green" | "cream" }) {
  return (
    <button type="button" className={`primary-button primary-button--${tone}`} onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}

function CountdownCard({ state, now }: { state: PersistedAppState; now: Date }) {
  if (state.assessment.status !== "active" || !state.assessment.expiresAt) return null;
  const remaining = new Date(state.assessment.expiresAt).getTime() - now.getTime();
  return (
    <section className="countdown-card" aria-live="polite">
      <div>
        <Clock3 aria-hidden="true" />
        <span>Осталось на тестирование</span>
      </div>
      <strong>{formatCountdown(remaining)}</strong>
      <p>Срок завершится {formatMoscow(new Date(state.assessment.expiresAt))} МСК</p>
    </section>
  );
}

function HomeScreen({ profile, state, now, go, startTest }: { profile: CandidateProfile; state: PersistedAppState; now: Date; go: (section: AppSection) => void; startTest: () => void }) {
  const assessmentDone = state.assessment.status === "completed";
  const completed = state.academy.completedDays.length;
  return (
    <>
      <section className="hero">
        <div className="hero__ornament" aria-hidden="true"><span /><span /><span /></div>
        <div className="hero__content">
          <div className="status-pill"><Sparkles aria-hidden="true" /> Путь кандидата</div>
          <h1>Стартуй.<br /><i>Учись.</i><br />Становись своим.</h1>
          <p>Первичное тестирование и семь учебных дней координатора HOMEPOINT — в одном приложении.</p>
          {state.assessment.status === "idle" ? (
            <PrimaryButton onClick={startTest}>Начать тестирование</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => go(assessmentDone ? "academy" : "test")}>
              {assessmentDone ? "Перейти к обучению" : "Продолжить тест"}
            </PrimaryButton>
          )}
        </div>
        <div className="hero__footer">
          <div><strong>24</strong><span>часа<br />на тест</span></div>
          <div><strong>7</strong><span>учебных<br />дней</span></div>
          <div><strong>МСК</strong><span>единое<br />время</span></div>
        </div>
      </section>

      <CountdownCard state={state} now={now} />

      <section className="section-block">
        <div className="section-heading">
          <div><Eyebrow>Твой маршрут</Eyebrow><h2>Три понятных этапа</h2></div>
          <span>{assessmentDone ? (state.academy.access === "granted" ? "2 из 3" : "1 из 3") : "0 из 3"}</span>
        </div>
        <div className="journey-list">
          <button type="button" onClick={() => go("test")} className={assessmentDone ? "is-done" : "is-current"}>
            <span className="journey-list__number">01</span><span><b>Первичное тестирование</b><small>{assessmentDone ? `Завершено · ${state.assessment.score}%` : "24 часа после нажатия «Старт»"}</small></span><ChevronRight />
          </button>
          <button type="button" onClick={() => go("academy")} className={state.academy.access === "granted" ? "is-current" : ""}>
            <span className="journey-list__number">02</span><span><b>Доступ менеджера</b><small>{state.academy.access === "granted" ? "Доступ выдан" : state.academy.access === "pending" ? "Запрос на рассмотрении" : "После завершения теста"}</small></span>{state.academy.access === "granted" ? <Check /> : <LockKeyhole />}
          </button>
          <button type="button" onClick={() => go("academy")} className={completed > 0 ? "is-current" : ""}>
            <span className="journey-list__number">03</span><span><b>Академия HOMEPOINT</b><small>{completed ? `${completed} из 7 дней пройдено` : "7 рабочих дней · ПН–ПТ"}</small></span><ChevronRight />
          </button>
        </div>
      </section>

      <section className="feature-banner" onClick={() => go("library")}>
        <div className="feature-banner__icon"><BookOpen /></div>
        <div><Eyebrow>База знаний</Eyebrow><h3>Все референсы всегда под рукой</h3><p>Регламенты, карточки товаров, скрипты и инструкции внутри уроков.</p></div>
        <ChevronRight />
      </section>

      <section className="welcome-strip">
        <Avatar profile={profile} />
        <div><b>{profile.firstName}, добро пожаловать</b><span>Прогресс привязан к твоему Telegram-аккаунту</span></div>
        <ShieldCheck />
      </section>
    </>
  );
}

function TestScreen({ state, now, update, startTest }: { state: PersistedAppState; now: Date; update: (next: PersistedAppState) => void; startTest: () => void }) {
  const answers = state.assessment.answers;
  const currentIndex = assessmentQuestions.findIndex((question) => answers[question.id] === undefined);
  const question = assessmentQuestions[Math.max(0, currentIndex)];

  const answer = (value: number) => {
    const nextAnswers = { ...answers, [question.id]: String(value) };
    const finished = Object.keys(nextAnswers).length === assessmentQuestions.length;
    const score = finished
      ? Math.round((assessmentQuestions.filter((item) => Number(nextAnswers[item.id]) === item.correct).length / assessmentQuestions.length) * 100)
      : undefined;
    update({ ...state, assessment: { ...state.assessment, answers: nextAnswers, status: finished ? "completed" : "active", score } });
  };

  if (state.assessment.status === "idle") return (
    <section className="test-intro">
      <div className="test-intro__mark"><Clock3 /></div>
      <Eyebrow>Первичный отбор</Eyebrow>
      <h1>Таймер не запущен</h1>
      <p>Ты можешь спокойно ознакомиться с правилами. Отсчёт 24 часов начнётся только после нажатия кнопки ниже.</p>
      <div className="rules-card">
        <div><span>01</span><p><b>5 ситуационных вопросов</b><small>Каждый вопрос основан на реальной работе координатора.</small></p></div>
        <div><span>02</span><p><b>24 часа без пауз</b><small>Закрытие приложения не останавливает серверный таймер.</small></p></div>
        <div><span>03</span><p><b>Один основной результат</b><small>После завершения можно запросить доступ к Академии.</small></p></div>
      </div>
      <PrimaryButton onClick={startTest}>Запустить 24 часа</PrimaryButton>
    </section>
  );

  if (state.assessment.status === "expired") return (
    <section className="result-card result-card--expired">
      <Clock3 /><Eyebrow>Время вышло</Eyebrow><h1>Тестирование завершено по таймеру</h1><p>Результат зафиксирован. Для повторного доступа свяжись с менеджером.</p>
    </section>
  );

  if (state.assessment.status === "completed") return (
    <section className="result-card">
      <div className="score-ring"><strong>{state.assessment.score}%</strong><span>результат</span></div>
      <Eyebrow>Тестирование завершено</Eyebrow>
      <h1>Результат сохранён</h1>
      <p>Теперь можно отправить менеджеру запрос на персональный доступ к семидневной Академии.</p>
      <div className="result-metrics"><div><b>{assessmentQuestions.length}</b><span>вопросов</span></div><div><b>{formatMoscow(now)}</b><span>сохранено по МСК</span></div></div>
    </section>
  );

  return (
    <section className="question-screen">
      <CountdownCard state={state} now={now} />
      <div className="question-progress"><span style={{ width: `${(Object.keys(answers).length / assessmentQuestions.length) * 100}%` }} /></div>
      <div className="question-meta"><span>Вопрос {Object.keys(answers).length + 1} из {assessmentQuestions.length}</span><span>Ситуация</span></div>
      <h1>{question.question}</h1>
      <p className="question-hint">{question.hint}</p>
      <div className="answers">
        {question.options.map((option, index) => (
          <button type="button" key={option} onClick={() => answer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}<ChevronRight /></button>
        ))}
      </div>
    </section>
  );
}

function AcademyScreen({ state, now, update }: { state: PersistedAppState; now: Date; update: (next: PersistedAppState) => void }) {
  const [openedDay, setOpenedDay] = useState<number | null>(null);
  const requestAccess = () => update({ ...state, academy: { ...state.academy, access: "pending" } });
  const completeDay = (day: number) => {
    const completedDays = [...new Set([...state.academy.completedDays, day])].sort((a, b) => a - b);
    update({ ...state, academy: { ...state.academy, completedDays, activeDay: Math.min(7, day + 1), lastCompletedAt: new Date().toISOString() } });
    setOpenedDay(null);
  };

  if (state.assessment.status !== "completed") return (
    <section className="academy-lock">
      <LockKeyhole /><Eyebrow>Академия закрыта</Eyebrow><h1>Сначала заверши первичное тестирование</h1><p>Запрос менеджеру станет доступен сразу после фиксации результата.</p>
    </section>
  );

  if (state.academy.access !== "granted") return (
    <section className="academy-lock academy-lock--access">
      <div className="academy-lock__seal"><ShieldCheck /></div>
      <Eyebrow>Персональный доступ</Eyebrow>
      <h1>{state.academy.access === "pending" ? "Запрос уже у менеджера" : "Получи доступ к обучению"}</h1>
      <p>{state.academy.access === "pending" ? "Менеджер проверит результат и откроет Академию для твоего Telegram-аккаунта. Статус обновится автоматически." : "Доступ выдаётся менеджером индивидуально и привязывается к Telegram ID кандидата."}</p>
      <div className="access-flow"><span className="is-done"><Check /></span><i /><span className={state.academy.access === "pending" ? "is-current" : ""}><Send /></span><i /><span><GraduationCap /></span></div>
      <div className="access-labels"><span>Тест готов</span><span>Запрос</span><span>Академия</span></div>
      {state.academy.access === "locked" ? <PrimaryButton onClick={requestAccess}>Запросить доступ</PrimaryButton> : <button className="pending-button" type="button" disabled><Clock3 /> Ожидает решения</button>}
    </section>
  );

  if (openedDay) {
    const day = trainingDays[openedDay - 1];
    const Icon = day.icon;
    return (
      <section className="day-view">
        <button type="button" className="back-button" onClick={() => setOpenedDay(null)}><ArrowLeft /> Программа</button>
        <div className={`day-cover day-cover--${day.accent}`}><Icon /><Eyebrow>День {day.day} · {day.duration}</Eyebrow><h1>{day.title}</h1><p>{day.summary}</p></div>
        <div className="lesson-list">
          {["Короткая теория", "Разбор рабочего процесса", "Референсы и карточки", "Практическая ситуация", day.day === 7 ? "Финальное тестирование" : "Проверка дня"].map((item, index) => (
            <div key={item}><span>{index + 1}</span><p><b>{item}</b><small>{index === 2 ? "Материалы встроены в урок" : "Последовательный экран обучения"}</small></p>{index < 4 ? <Check /> : <ChevronRight />}</div>
          ))}
        </div>
        <PrimaryButton onClick={() => completeDay(day.day)}>{day.day === 7 ? "Завершить Академию" : "Завершить учебный день"}</PrimaryButton>
      </section>
    );
  }

  return (
    <>
      <section className="academy-hero">
        <div><Eyebrow>Академия координатора</Eyebrow><h1>7 дней до уверенной работы</h1><p>Новый блок открывается в 00:00 следующего рабочего дня по московскому времени.</p></div>
        <div className="academy-progress"><strong>{state.academy.completedDays.length}<span>/7</span></strong><small>дней пройдено</small></div>
      </section>
      <div className="schedule-note"><Clock3 /><span><b>ПН–ПТ · время МСК</b><small>Суббота и воскресенье не считаются учебными днями</small></span></div>
      <section className="days-list">
        {trainingDays.map((day) => {
          const gate = academyGate(state, day.day, now);
          const complete = state.academy.completedDays.includes(day.day);
          const Icon = day.icon;
          return (
            <button type="button" key={day.day} disabled={!gate.open} onClick={() => setOpenedDay(day.day)} className={`${complete ? "is-complete" : gate.open ? "is-open" : "is-locked"}`}>
              <span className={`day-icon day-icon--${day.accent}`}><Icon /></span>
              <span className="day-copy"><small>День {day.day} · {day.duration}</small><b>{day.title}</b><em>{gate.label}</em></span>
              {complete ? <span className="day-status"><Check /></span> : gate.open ? <ChevronRight /> : <LockKeyhole />}
            </button>
          );
        })}
      </section>
    </>
  );
}

function LibraryScreen() {
  return (
    <>
      <section className="library-hero"><Eyebrow>База знаний</Eyebrow><h1>Референсы без ограничений</h1><p>Внутрь можно загрузить инструкции, изображения, PDF, видео, карточки товаров и рабочие примеры.</p><div><Library /><span><b>{references.length}</b><small>материалов в демо</small></span></div></section>
      <div className="filter-row"><button className="is-active">Все</button><button>Товары</button><button>Скрипты</button><button>Регламенты</button></div>
      <section className="reference-grid">
        {references.map((item, index) => <button type="button" key={item.title} className={`reference-card reference-card--${item.tone}`}><span className="reference-card__index">{String(index + 1).padStart(2, "0")}</span><span><small>{item.type}</small><b>{item.title}</b><em>{item.meta}</em></span><ArrowRight /></button>)}
      </section>
    </>
  );
}

function ProfileScreen({ profile, state }: { profile: CandidateProfile; state: PersistedAppState }) {
  return (
    <>
      <section className="profile-hero"><Avatar profile={profile} large /><Eyebrow>Аккаунт кандидата</Eyebrow><h1>{profile.firstName} {profile.lastName}</h1><p>{profile.username ? `@${profile.username}` : "Telegram-профиль"}</p><span className="verified"><ShieldCheck /> Telegram подтверждён</span></section>
      <section className="profile-stats"><div><span>Тест</span><b>{state.assessment.status === "completed" ? `${state.assessment.score}%` : "—"}</b></div><div><span>Доступ</span><b>{state.academy.access === "granted" ? "Открыт" : state.academy.access === "pending" ? "Запрошен" : "Закрыт"}</b></div><div><span>Академия</span><b>{state.academy.completedDays.length}/7</b></div></section>
      <section className="account-list"><div><span>Telegram ID</span><b>{profile.telegramId}</b></div><div><span>Часовой пояс обучения</span><b>Москва · UTC+3</b></div><div><span>Прогресс</span><b>Хранится на сервере</b></div></section>
      <a className="manager-link" href="./manager/"><ShieldCheck /><span><b>Демо кабинета менеджера</b><small>Выдача доступа по Telegram-аккаунту</small></span><ChevronRight /></a>
    </>
  );
}

export default function HomepointApp() {
  const [profile, setProfile] = useState<CandidateProfile>({ telegramId: "loading", firstName: "Кандидат" });
  const [state, setState] = useState<PersistedAppState>(defaultState);
  const [section, setSection] = useState<AppSection>("home");
  const [now, setNow] = useState(() => new Date(0));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setProfile(initTelegram());
      setNow(new Date());
      setState(readState());
      setHydrated(true);
    });
    const timer = window.setInterval(() => {
      const currentTime = new Date();
      setNow(currentTime);
      setState((current) => {
        if (current.assessment.status !== "active" || !current.assessment.expiresAt || currentTime.getTime() < new Date(current.assessment.expiresAt).getTime()) return current;
        const expired = { ...current, assessment: { ...current.assessment, status: "expired" as const } };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expired));
        return expired;
      });
    }, 1000);
    const sync = () => setState(readState());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);

  const update = (next: PersistedAppState) => {
    setState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const startTest = () => {
    if (state.assessment.status !== "idle") { setSection("test"); return; }
    const startedAt = new Date();
    update({ ...state, assessment: { status: "active", startedAt: startedAt.toISOString(), expiresAt: new Date(startedAt.getTime() + DAY).toISOString(), answers: {} } });
    setSection("test");
  };

  let content: React.ReactNode;
  if (section === "test") content = <TestScreen state={state} now={now} update={update} startTest={startTest} />;
  else if (section === "academy") content = <AcademyScreen state={state} now={now} update={update} />;
  else if (section === "library") content = <LibraryScreen />;
  else if (section === "profile") content = <ProfileScreen profile={profile} state={state} />;
  else content = <HomeScreen profile={profile} state={state} now={now} go={setSection} startTest={startTest} />;

  if (!hydrated) return <main className="app-shell loading-shell"><div className="loading-mark">HP</div><p>Открываем HOMEPOINT</p></main>;

  return (
    <main className="app-shell">
      <TopBar profile={profile} />
      <div className="app-content" key={section}>{content}</div>
      <BottomNav active={section} onChange={setSection} />
    </main>
  );
}

