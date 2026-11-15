"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  Library,
  ListChecks,
  LockKeyhole,
  MessageCircleMore,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  assessmentBlocks,
  catalogItems,
  finalAssessmentQuestions,
  trainingDays,
  type CatalogItem,
  type QuizQuestion,
  type TrainingDay,
} from "@/lib/content";
import { initTelegram } from "@/lib/telegram";
import type { AppSection, CandidateProfile, DayProgress, PersistedAppState } from "@/lib/types";

const STORAGE_KEY = "homepoint:candidate:v2";
const DAY = 24 * 60 * 60 * 1000;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const emptyDayProgress = (): DayProgress => ({ quizAnswers: {}, simulationStep: 0, simulationScore: 0 });
const defaultState: PersistedAppState = {
  assessment: { status: "idle", answers: {}, completedBlocks: [] },
  academy: { access: "locked", completedDays: [], activeDay: 1, dayProgress: {} },
};

function readState(): PersistedAppState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored) as Partial<PersistedAppState>;
    return {
      assessment: { ...defaultState.assessment, ...parsed.assessment },
      academy: { ...defaultState.academy, ...parsed.academy, dayProgress: parsed.academy?.dayProgress ?? {} },
    };
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
  const source = moscowParts(new Date(completedAt));
  let candidate = new Date(`${source.year}-${source.month}-${source.day}T21:00:00.000Z`);
  candidate = new Date(candidate.getTime() + DAY);
  while (["Sat", "Sun"].includes(moscowParts(candidate).weekday)) candidate = new Date(candidate.getTime() + DAY);
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
  return (
    <div className={`avatar ${large ? "avatar--large" : ""}`} style={profile.photoUrl ? { backgroundImage: `url(${profile.photoUrl})` } : undefined} role="img" aria-label={`Фото ${profile.firstName}`}>
      {!profile.photoUrl ? initials(profile) : null}
    </div>
  );
}

function TopBar({ profile, onProfile }: { profile: CandidateProfile; onProfile: () => void }) {
  return (
    <header className="topbar">
      <div className="wordmark" aria-label="HOMEPOINT">HOME<span>POINT</span></div>
      <button className="profile-chip" type="button" aria-label="Открыть профиль" onClick={onProfile}>
        <span><b>{profile.firstName}</b><small>{profile.username ? `@${profile.username}` : "Кандидат"}</small></span>
        <Avatar profile={profile} />
      </button>
    </header>
  );
}

function BottomNav({ active, onChange }: { active: AppSection; onChange: (section: AppSection) => void }) {
  const items = [["home", Home, "Главная"], ["test", FileText, "Отбор"], ["academy", GraduationCap, "Обучение"], ["library", Library, "Каталог"], ["profile", UserRound, "Профиль"]] as const;
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map(([id, Icon, label]) => <button key={id} type="button" className={active === id ? "is-active" : ""} onClick={() => onChange(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
    </nav>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) { return <p className="eyebrow">{children}</p>; }

function PrimaryButton({ children, onClick, disabled = false, tone = "green" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "green" | "cream" }) {
  return <button type="button" className={`primary-button primary-button--${tone}`} onClick={onClick} disabled={disabled}><span>{children}</span><ArrowRight aria-hidden="true" /></button>;
}

function CountdownCard({ state, now }: { state: PersistedAppState; now: Date }) {
  if (state.assessment.status !== "active" || !state.assessment.expiresAt) return null;
  const remaining = new Date(state.assessment.expiresAt).getTime() - now.getTime();
  return <section className="countdown-card" aria-live="polite"><div><Clock3 /><span>Осталось на первичный отбор</span></div><strong>{formatCountdown(remaining)}</strong><p>Срок завершится {formatMoscow(new Date(state.assessment.expiresAt))} МСК</p></section>;
}

function HomeScreen({ profile, state, now, go, startTest }: { profile: CandidateProfile; state: PersistedAppState; now: Date; go: (section: AppSection) => void; startTest: () => void }) {
  const done = state.assessment.status === "completed";
  return (
    <>
      <section className="hero">
        <div className="hero__ornament" aria-hidden="true"><span /><span /><span /></div>
        <div className="hero__content">
          <div className="status-pill"><GraduationCap /> Академия координатора</div>
          <h1>Система работы<br /><i>координатора.</i></h1>
          <p>Последовательная подготовка: шесть вводных модулей, итоговая проверка и семь дней практики.</p>
          {state.assessment.status === "idle" ? <PrimaryButton onClick={startTest}>Начать первичный отбор</PrimaryButton> : <PrimaryButton onClick={() => go(done ? "academy" : "test")}>{done ? "Перейти к обучению" : "Продолжить отбор"}</PrimaryButton>}
        </div>
        <div className="hero__footer"><div><strong>24</strong><span>часа<br />на отбор</span></div><div><strong>6+1</strong><span>учебных<br />блоков</span></div><div><strong>7</strong><span>дней<br />Академии</span></div></div>
      </section>
      <CountdownCard state={state} now={now} />
      <section className="section-block">
        <div className="section-heading"><div><Eyebrow>Маршрут кандидата</Eyebrow><h2>От отбора до практики</h2></div><span>{done ? (state.academy.access === "granted" ? "2 из 3" : "1 из 3") : "0 из 3"}</span></div>
        <div className="journey-list">
          <button type="button" onClick={() => go("test")} className={done ? "is-done" : "is-current"}><span className="journey-list__number">01</span><span><b>Первичный отбор</b><small>{done ? `Завершён · ${state.assessment.score}%` : `${state.assessment.completedBlocks.length} из 6 блоков · итоговый тест`}</small></span><ChevronRight /></button>
          <button type="button" onClick={() => go("academy")} className={state.academy.access === "granted" ? "is-current" : ""}><span className="journey-list__number">02</span><span><b>Доступ менеджера</b><small>{state.academy.access === "granted" ? "Доступ выдан" : state.academy.access === "pending" ? "Запрос рассматривается" : "После итогового теста"}</small></span>{state.academy.access === "granted" ? <Check /> : <LockKeyhole />}</button>
          <button type="button" onClick={() => go("academy")} className={state.academy.completedDays.length ? "is-current" : ""}><span className="journey-list__number">03</span><span><b>Академия HOMEPOINT</b><small>{state.academy.completedDays.length ? `${state.academy.completedDays.length} из 7 дней` : "Теория · тест · симуляция"}</small></span><ChevronRight /></button>
        </div>
      </section>
      <button type="button" className="feature-banner" onClick={() => go("library")}>
        <div className="feature-banner__icon"><BookOpen /></div><div><Eyebrow>Рабочие материалы</Eyebrow><h3>Каталог HOMEPOINT</h3><p>Товары, скрипты и регламенты с подробными карточками.</p></div><ChevronRight />
      </button>
      <section className="welcome-strip"><Avatar profile={profile} /><div><b>{profile.firstName}, профиль подключён</b><span>Прогресс привязан к Telegram-аккаунту</span></div><ShieldCheck /></section>
    </>
  );
}

function ProductReferences({ context }: { context: number }) {
  const ids = context === 2 ? ["ref-modular-sofa", "ref-oak-dining"] : context === 4 ? ["ref-oak-dining"] : context === 5 || context === 6 ? ["ref-reading-corner"] : ["ref-modular-sofa"];
  const items = ids.map((id) => catalogItems.find((item) => item.id === id)).filter(Boolean) as CatalogItem[];
  return <section className="inline-references"><div className="inline-references__heading"><div><Eyebrow>Товарные референсы</Eyebrow><h2>Примеры для работы</h2></div><span>{items.length}</span></div>{items.map((item) => <article key={item.id}>{item.image ? <Image src={`${APP_BASE_PATH}${item.image}`} alt={item.title} width={1536} height={1024} sizes="(max-width: 700px) 100vw, 520px" /> : null}<div><small>{item.meta}</small><h3>{item.title}</h3><p>{item.summary}</p><ul>{item.sections[0].bullets.slice(0, 3).map((bullet) => <li key={bullet}><Check />{bullet}</li>)}</ul></div></article>)}</section>;
}

function TheoryView({ title, intro, chapters, onBack, onContinue, continueLabel, referenceContext }: { title: string; intro: string; chapters: TrainingDay["chapters"]; onBack: () => void; onContinue: () => void; continueLabel: string; referenceContext: number }) {
  return (
    <section className="theory-view">
      <button type="button" className="back-button" onClick={onBack}><ArrowLeft /> Назад</button>
      <Eyebrow>Материал блока</Eyebrow><h1>{title}</h1><p className="theory-lead">{intro}</p>
      <div className="reading-summary"><BookOpen /><span><b>{chapters.reduce((sum, item) => sum + item.readingMinutes, 0)} минут чтения</b><small>{chapters.length} раздела · конспект и чек-листы</small></span></div>
      <ProductReferences context={referenceContext} />
      <div className="chapter-list">{chapters.map((item, index) => <article className="chapter-card" key={item.title}><header><span>{String(index + 1).padStart(2, "0")}</span><div><small>{item.readingMinutes} мин</small><h2>{item.title}</h2></div></header>{item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<ul>{item.bullets.map((bullet) => <li key={bullet}><Check />{bullet}</li>)}</ul></article>)}</div>
      <PrimaryButton onClick={onContinue}>{continueLabel}</PrimaryButton>
    </section>
  );
}

function QuestionFlow({ questions, answers, onAnswer, label }: { questions: QuizQuestion[]; answers: Record<string, string>; onAnswer: (question: QuizQuestion, option: number) => void; label: string }) {
  const currentIndex = questions.findIndex((item) => answers[item.id] === undefined);
  const current = questions[Math.max(0, currentIndex)];
  const answered = questions.filter((item) => answers[item.id] !== undefined).length;
  return (
    <section className="question-screen">
      <div className="question-progress"><span style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
      <div className="question-meta"><span>{label}</span><span>Вопрос {answered + 1} из {questions.length}</span></div>
      <h1>{current.question}</h1>{current.hint ? <p className="question-hint">{current.hint}</p> : null}
      <div className="answers">{current.options.map((option, index) => <button type="button" key={option} onClick={() => onAnswer(current, index)}><span>{String.fromCharCode(65 + index)}</span>{option}<ChevronRight /></button>)}</div>
    </section>
  );
}

function TestScreen({ state, now, update, startTest }: { state: PersistedAppState; now: Date; update: (next: PersistedAppState) => void; startTest: () => void }) {
  const [openedBlock, setOpenedBlock] = useState<number | null>(null);
  const [quizBlock, setQuizBlock] = useState<number | null>(null);
  const [blockResult, setBlockResult] = useState<number | null>(null);

  if (state.assessment.status === "idle") return <section className="test-intro"><div className="test-intro__mark"><Clock3 /></div><Eyebrow>Первичный отбор</Eyebrow><h1>Таймер не запущен</h1><p>Отсчёт 24 часов начнётся только после нажатия кнопки. После запуска пройди шесть учебных блоков и итоговое тестирование.</p><div className="rules-card"><div><span>01</span><p><b>6 блоков с материалом</b><small>В каждом — теория и 5 проверочных вопросов.</small></p></div><div><span>02</span><p><b>Итоговый тест</b><small>12 ситуационных вопросов по всем темам.</small></p></div><div><span>03</span><p><b>24 часа без пауз</b><small>Таймер продолжает идти после закрытия приложения.</small></p></div></div><PrimaryButton onClick={startTest}>Запустить 24 часа</PrimaryButton></section>;

  if (state.assessment.status === "expired") return <section className="result-card result-card--expired"><Clock3 /><Eyebrow>Время вышло</Eyebrow><h1>Первичный отбор закрыт</h1><p>Результат зафиксирован. Для повторного доступа свяжись с менеджером.</p></section>;

  if (state.assessment.status === "completed") {
    const savedAt = state.assessment.completedAt ? new Date(state.assessment.completedAt) : now;
    return <section className="result-card"><div className="score-ring"><strong>{state.assessment.score}%</strong><span>результат</span></div><Eyebrow>Первичный отбор завершён</Eyebrow><h1>Результат сохранён</h1><p>Шесть блоков и итоговое тестирование пройдены. Теперь можно запросить доступ к семидневной Академии.</p><div className="result-metrics"><div><b>42</b><span>вопроса</span></div><div><b>{formatMoscow(savedAt)}</b><span>сохранено по МСК</span></div></div></section>;
  }

  if (state.assessment.finalStarted) {
    const finalAnswers = Object.fromEntries(Object.entries(state.assessment.answers).filter(([id]) => id.startsWith("f-")));
    const answerFinal = (item: QuizQuestion, value: number) => {
      const nextAnswers = { ...state.assessment.answers, [item.id]: String(value) };
      const finalDone = finalAssessmentQuestions.every((question) => nextAnswers[question.id] !== undefined);
      if (!finalDone) return update({ ...state, assessment: { ...state.assessment, answers: nextAnswers } });
      const allQuestions = [...assessmentBlocks.flatMap((block) => block.questions), ...finalAssessmentQuestions];
      const score = Math.round((allQuestions.filter((question) => Number(nextAnswers[question.id]) === question.correct).length / allQuestions.length) * 100);
      update({ ...state, assessment: { ...state.assessment, answers: nextAnswers, status: "completed", score, completedAt: new Date().toISOString() } });
    };
    return <><CountdownCard state={state} now={now} /><div className="final-test-banner"><ListChecks /><span><b>Итоговое тестирование</b><small>12 вопросов · изменить ответы нельзя</small></span></div><QuestionFlow questions={finalAssessmentQuestions} answers={finalAnswers} onAnswer={answerFinal} label="Финал" /></>;
  }

  if (blockResult) {
    const block = assessmentBlocks[blockResult - 1];
    const correct = block.questions.filter((item) => Number(state.assessment.answers[item.id]) === item.correct).length;
    return <section className="block-result"><button type="button" className="back-button" onClick={() => setBlockResult(null)}><ArrowLeft /> К программе</button><div className="block-result__score"><small>Результат блока {block.id}</small><strong>{correct}<span>/5</span></strong><p>{correct >= 4 ? "Материал усвоен. Следующий блок открыт." : "Блок завершён. Перед итоговым тестом вернись к ошибкам и повтори материал."}</p></div><div className="answer-review">{block.questions.map((item, index) => { const right = Number(state.assessment.answers[item.id]) === item.correct; return <article key={item.id} className={right ? "is-right" : "is-wrong"}><span>{right ? <Check /> : <X />}</span><div><small>Вопрос {index + 1}</small><b>{item.question}</b>{!right ? <p>Правильный ответ: {item.options[item.correct]}</p> : null}<em>{item.explanation}</em></div></article>; })}</div><PrimaryButton onClick={() => setBlockResult(null)}>Вернуться к блокам</PrimaryButton></section>;
  }

  if (quizBlock) {
    const block = assessmentBlocks[quizBlock - 1];
    const blockAnswers = Object.fromEntries(Object.entries(state.assessment.answers).filter(([id]) => id.startsWith(`b${quizBlock}-`)));
    const answerBlock = (item: QuizQuestion, value: number) => {
      const nextAnswers = { ...state.assessment.answers, [item.id]: String(value) };
      const finished = block.questions.every((question) => nextAnswers[question.id] !== undefined);
      if (!finished) return update({ ...state, assessment: { ...state.assessment, answers: nextAnswers } });
      const completedBlocks = [...new Set([...state.assessment.completedBlocks, block.id])].sort((a, b) => a - b);
      update({ ...state, assessment: { ...state.assessment, answers: nextAnswers, completedBlocks } });
      setQuizBlock(null); setOpenedBlock(null); setBlockResult(block.id);
    };
    return <><CountdownCard state={state} now={now} /><button type="button" className="back-button" onClick={() => setQuizBlock(null)}><ArrowLeft /> К материалу</button><QuestionFlow questions={block.questions} answers={blockAnswers} onAnswer={answerBlock} label={`Блок ${block.id}`} /></>;
  }

  if (openedBlock) {
    const block = assessmentBlocks[openedBlock - 1];
    const complete = state.assessment.completedBlocks.includes(block.id);
    return <TheoryView title={block.title} intro={block.intro} chapters={block.chapters} onBack={() => setOpenedBlock(null)} onContinue={() => complete ? setBlockResult(block.id) : setQuizBlock(block.id)} continueLabel={complete ? "Посмотреть результат блока" : "Пройти проверку · 5 вопросов"} referenceContext={block.id} />;
  }

  const allBlocksDone = state.assessment.completedBlocks.length === assessmentBlocks.length;
  return <><CountdownCard state={state} now={now} /><section className="assessment-overview"><Eyebrow>Первичный отбор</Eyebrow><h1>Шесть рабочих блоков</h1><p>Изучи материал каждого блока и ответь на пять вопросов. Итоговый тест откроется после завершения всех блоков.</p><div className="overview-progress"><span style={{ width: `${(state.assessment.completedBlocks.length / 6) * 100}%` }} /></div><small>{state.assessment.completedBlocks.length} из 6 блоков пройдено</small></section><section className="assessment-blocks">{assessmentBlocks.map((block) => {
    const done = state.assessment.completedBlocks.includes(block.id);
    const previousDone = block.id === 1 || state.assessment.completedBlocks.includes(block.id - 1);
    const score = done ? block.questions.filter((item) => Number(state.assessment.answers[item.id]) === item.correct).length : null;
    return <button type="button" key={block.id} disabled={!previousDone} onClick={() => setOpenedBlock(block.id)} className={done ? "is-complete" : previousDone ? "is-open" : "is-locked"}><span>{block.id}</span><div><small>{block.kicker} · {block.duration}</small><b>{block.title}</b><em>{done ? "Материал и проверка завершены" : previousDone ? "Изучить материал" : `После блока ${block.id - 1}`}</em></div>{score !== null ? <strong className="block-score">{score}/5</strong> : previousDone ? <ChevronRight /> : <LockKeyhole />}</button>;
  })}</section><section className={`final-unlock ${allBlocksDone ? "is-ready" : "is-locked"}`}><ListChecks /><Eyebrow>{allBlocksDone ? "Все блоки пройдены" : "Откроется после 6 блоков"}</Eyebrow><h2>Итоговый тест · 12 вопросов</h2><p>Ситуационные задачи по всему материалу и единый итоговый балл.</p>{allBlocksDone ? <PrimaryButton onClick={() => update({ ...state, assessment: { ...state.assessment, finalStarted: true } })}>Начать итоговый тест</PrimaryButton> : <div className="final-lock"><LockKeyhole /> Заверши оставшиеся блоки</div>}</section></>;
}

function AcademyDayView({ day, state, update, onBack, onComplete }: { day: TrainingDay; state: PersistedAppState; update: (next: PersistedAppState) => void; onBack: () => void; onComplete: () => void }) {
  const DayIcon = day.icon;
  const [tab, setTab] = useState<"theory" | "quiz" | "simulation">("theory");
  const [feedback, setFeedback] = useState<{ text: string; best: boolean } | null>(null);
  const progress = state.academy.dayProgress[String(day.day)] ?? emptyDayProgress();
  const quizComplete = day.quiz.every((item) => progress.quizAnswers[item.id] !== undefined);
  const simulationComplete = progress.simulationStep >= day.simulation.turns.length;

  const updateProgress = (nextProgress: DayProgress) => update({ ...state, academy: { ...state.academy, dayProgress: { ...state.academy.dayProgress, [String(day.day)]: nextProgress } } });

  const answerQuiz = (item: QuizQuestion, value: number) => {
    const answers = { ...progress.quizAnswers, [item.id]: String(value) };
    const finished = day.quiz.every((question) => answers[question.id] !== undefined);
    const score = finished ? Math.round((day.quiz.filter((question) => Number(answers[question.id]) === question.correct).length / day.quiz.length) * 100) : undefined;
    updateProgress({ ...progress, quizAnswers: answers, quizScore: score });
  };

  const chooseSimulation = (best: boolean, text: string) => setFeedback({ best, text });
  const nextSimulation = () => {
    if (!feedback) return;
    updateProgress({ ...progress, simulationStep: progress.simulationStep + 1, simulationScore: progress.simulationScore + (feedback.best ? 1 : 0) });
    setFeedback(null);
  };

  return <section className="day-view"><button type="button" className="back-button" onClick={onBack}><ArrowLeft /> Программа</button><div className={`day-cover day-cover--${day.accent}`}><DayIcon /><Eyebrow>День {day.day} · {day.duration}</Eyebrow><h1>{day.title}</h1><p>{day.summary}</p><div className="day-outcomes">{day.outcomes.map((item) => <span key={item}><Check />{item}</span>)}</div></div><div className="lesson-tabs" role="tablist"><button type="button" className={tab === "theory" ? "is-active" : ""} onClick={() => setTab("theory")}><BookOpen />Материал</button><button type="button" className={tab === "quiz" ? "is-active" : ""} onClick={() => setTab("quiz")}><ListChecks />Тест {quizComplete ? <Check /> : null}</button><button type="button" className={tab === "simulation" ? "is-active" : ""} onClick={() => setTab("simulation")}><MessageCircleMore />Диалог {simulationComplete ? <Check /> : null}</button></div>
    {tab === "theory" ? <><div className="reading-summary"><BookOpen /><span><b>{day.theoryMinutes} минут теории</b><small>{day.chapters.length} содержательных раздела</small></span></div><ProductReferences context={day.day} /><div className="chapter-list">{day.chapters.map((item, index) => <article className="chapter-card" key={item.title}><header><span>{String(index + 1).padStart(2, "0")}</span><div><small>{item.readingMinutes} мин</small><h2>{item.title}</h2></div></header>{item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<ul>{item.bullets.map((bullet) => <li key={bullet}><Check />{bullet}</li>)}</ul></article>)}</div><PrimaryButton onClick={() => setTab("quiz")}>Перейти к тесту</PrimaryButton></> : null}
    {tab === "quiz" ? quizComplete ? <section className="module-result"><CheckCircle2 /><Eyebrow>Тест завершён</Eyebrow><h2>{progress.quizScore}%</h2><p>Правильных ответов: {Math.round(((progress.quizScore ?? 0) / 100) * day.quiz.length)} из {day.quiz.length}. Теперь пройди симуляцию диалога.</p><PrimaryButton onClick={() => setTab("simulation")}>Открыть симуляцию</PrimaryButton></section> : <QuestionFlow questions={day.quiz} answers={progress.quizAnswers} onAnswer={answerQuiz} label={`День ${day.day}`} /> : null}
    {tab === "simulation" ? simulationComplete ? <section className="module-result"><MessageCircleMore /><Eyebrow>Симуляция завершена</Eyebrow><h2>{progress.simulationScore}/{day.simulation.turns.length}</h2><p>Диалог пройден. День можно завершить после теста и симуляции.</p></section> : <section className="simulation"><Eyebrow>Тренажёр диалога</Eyebrow><h2>{day.simulation.title}</h2><p>{day.simulation.context}</p><div className="simulation-step">Ситуация {progress.simulationStep + 1} из {day.simulation.turns.length}</div><div className="client-bubble"><small>Клиент</small>{day.simulation.turns[progress.simulationStep].client}</div><h3>{day.simulation.turns[progress.simulationStep].prompt}</h3><div className="dialogue-options">{day.simulation.turns[progress.simulationStep].options.map((option) => <button type="button" key={option.text} disabled={Boolean(feedback)} onClick={() => chooseSimulation(option.best, option.feedback)}>{option.text}</button>)}</div>{feedback ? <div className={`simulation-feedback ${feedback.best ? "is-good" : "is-warn"}`}><b>{feedback.best ? "Сильный ответ" : "Есть риск"}</b><p>{feedback.text}</p><button type="button" onClick={nextSimulation}>Продолжить <ArrowRight /></button></div> : null}</section> : null}
    <div className="day-completion"><div><span className={quizComplete ? "is-done" : ""}>{quizComplete ? <Check /> : "1"}</span>Тест 10 вопросов</div><div><span className={simulationComplete ? "is-done" : ""}>{simulationComplete ? <Check /> : "2"}</span>Симуляция</div></div><PrimaryButton onClick={onComplete} disabled={!quizComplete || !simulationComplete}>{day.day === 7 ? "Завершить Академию" : "Завершить учебный день"}</PrimaryButton></section>;
}

function AcademyScreen({ state, now, update }: { state: PersistedAppState; now: Date; update: (next: PersistedAppState) => void }) {
  const [openedDay, setOpenedDay] = useState<number | null>(null);
  const requestAccess = () => update({ ...state, academy: { ...state.academy, access: "pending" } });
  const completeDay = (day: number) => {
    const completedDays = [...new Set([...state.academy.completedDays, day])].sort((a, b) => a - b);
    update({ ...state, academy: { ...state.academy, completedDays, activeDay: Math.min(7, day + 1), lastCompletedAt: new Date().toISOString() } });
    setOpenedDay(null);
  };
  if (state.assessment.status !== "completed") return <section className="academy-lock"><LockKeyhole /><Eyebrow>Академия закрыта</Eyebrow><h1>Сначала заверши первичный отбор</h1><p>Пройди шесть блоков и итоговое тестирование. После результата откроется запрос менеджеру.</p></section>;
  if (state.academy.access !== "granted") return <section className="academy-lock academy-lock--access"><div className="academy-lock__seal"><ShieldCheck /></div><Eyebrow>Персональный доступ</Eyebrow><h1>{state.academy.access === "pending" ? "Запрос уже у менеджера" : "Получи доступ к обучению"}</h1><p>{state.academy.access === "pending" ? "Менеджер проверит результат и откроет Академию для Telegram-аккаунта." : "Доступ выдаётся индивидуально и привязывается к Telegram ID кандидата."}</p><div className="access-flow"><span className="is-done"><Check /></span><i /><span className={state.academy.access === "pending" ? "is-current" : ""}><Send /></span><i /><span><GraduationCap /></span></div><div className="access-labels"><span>Отбор готов</span><span>Запрос</span><span>Академия</span></div>{state.academy.access === "locked" ? <PrimaryButton onClick={requestAccess}>Запросить доступ</PrimaryButton> : <button className="pending-button" type="button" disabled><Clock3 /> Ожидает решения</button>}</section>;
  if (openedDay) return <AcademyDayView day={trainingDays[openedDay - 1]} state={state} update={update} onBack={() => setOpenedDay(null)} onComplete={() => completeDay(openedDay)} />;
  return <><section className="academy-hero"><div><Eyebrow>Академия координатора</Eyebrow><h1>7 рабочих дней практики</h1><p>В каждом дне: 30 минут теории, 10 вопросов и симуляция диалога.</p></div><div className="academy-progress"><strong>{state.academy.completedDays.length}<span>/7</span></strong><small>дней пройдено</small></div></section><div className="schedule-note"><Clock3 /><span><b>ПН–ПТ · время МСК</b><small>Следующий день открывается в 00:00 следующего рабочего дня</small></span></div><section className="days-list">{trainingDays.map((day) => { const gate = academyGate(state, day.day, now); const complete = state.academy.completedDays.includes(day.day); const Icon = day.icon; return <button type="button" key={day.day} disabled={!gate.open} onClick={() => setOpenedDay(day.day)} className={complete ? "is-complete" : gate.open ? "is-open" : "is-locked"}><span className={`day-icon day-icon--${day.accent}`}><Icon /></span><span className="day-copy"><small>День {day.day} · {day.duration}</small><b>{day.title}</b><em>{gate.label}</em></span>{complete ? <span className="day-status"><Check /></span> : gate.open ? <ChevronRight /> : <LockKeyhole />}</button>; })}</section></>;
}

function LibraryScreen() {
  const [filter, setFilter] = useState<"Все" | CatalogItem["category"]>("Все");
  const [opened, setOpened] = useState<CatalogItem | null>(null);
  const items = filter === "Все" ? catalogItems : catalogItems.filter((item) => item.category === filter);
  if (opened) return <section className="catalog-detail"><button type="button" className="back-button" onClick={() => setOpened(null)}><ArrowLeft /> Каталог</button>{opened.image ? <Image className="catalog-detail__image" src={`${APP_BASE_PATH}${opened.image}`} alt={`Товарный референс: ${opened.title}`} width={1536} height={1024} sizes="(max-width: 700px) 100vw, 520px" /> : null}<div className={`catalog-cover reference-card--${opened.tone}`}><small>{opened.category} · {opened.meta}</small><h1>{opened.title}</h1><p>{opened.summary}</p></div>{opened.sections.map((section) => <article key={section.title}><h2>{section.title}</h2><p>{section.body}</p><ul>{section.bullets.map((bullet) => <li key={bullet}><Check />{bullet}</li>)}</ul></article>)}</section>;
  return <><section className="catalog-feature"><Image src={`${APP_BASE_PATH}/references/modular-sofa.png`} alt="Светлый модульный диван в интерьере" width={1536} height={1024} priority sizes="(max-width: 700px) 100vw, 520px" /><div><Eyebrow>Каталог HOMEPOINT</Eyebrow><h1>Мебель в деталях</h1><p>Товарные референсы, характеристики и готовые аргументы для консультации.</p></div></section><div className="filter-row">{(["Все", "Референсы", "Товары", "Скрипты", "Регламенты"] as const).map((item) => <button type="button" key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><section className="reference-grid">{items.map((item, index) => <button type="button" key={item.id} onClick={() => setOpened(item)} className={`reference-card reference-card--${item.tone} ${item.image ? "reference-card--visual" : ""}`}>{item.image ? <Image src={`${APP_BASE_PATH}${item.image}`} alt="" aria-hidden="true" width={1536} height={1024} sizes="(max-width: 700px) 100vw, 260px" /> : null}<span className="reference-card__index">{String(index + 1).padStart(2, "0")}</span><span><small>{item.category}</small><b>{item.title}</b><em>{item.meta}</em></span><ArrowRight /></button>)}</section></>;
}

function ProfileScreen({ profile, state }: { profile: CandidateProfile; state: PersistedAppState }) {
  return <><section className="profile-hero"><Avatar profile={profile} large /><Eyebrow>Аккаунт кандидата</Eyebrow><h1>{profile.firstName} {profile.lastName}</h1><p>{profile.username ? `@${profile.username}` : "Telegram-профиль"}</p><span className="verified"><ShieldCheck /> Telegram подтверждён</span></section><section className="profile-stats"><div><span>Отбор</span><b>{state.assessment.status === "completed" ? `${state.assessment.score}%` : `${state.assessment.completedBlocks.length}/6`}</b></div><div><span>Доступ</span><b>{state.academy.access === "granted" ? "Открыт" : state.academy.access === "pending" ? "Запрошен" : "Закрыт"}</b></div><div><span>Академия</span><b>{state.academy.completedDays.length}/7</b></div></section><section className="account-list"><div><span>Telegram ID</span><b>{profile.telegramId}</b></div><div><span>Часовой пояс</span><b>Москва · UTC+3</b></div><div><span>Формат</span><b>Теория · тест · практика</b></div></section><a className="manager-link" href="./manager/"><ShieldCheck /><span><b>Кабинет менеджера</b><small>Выдача доступа по Telegram-аккаунту</small></span><ChevronRight /></a></>;
}

export default function HomepointApp() {
  const [profile, setProfile] = useState<CandidateProfile>({ telegramId: "loading", firstName: "Кандидат" });
  const [state, setState] = useState<PersistedAppState>(defaultState);
  const [section, setSection] = useState<AppSection>("home");
  const [now, setNow] = useState(() => new Date(0));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { setProfile(initTelegram()); setNow(new Date()); setState(readState()); setHydrated(true); });
    const timer = window.setInterval(() => {
      const currentTime = new Date(); setNow(currentTime);
      setState((current) => {
        if (current.assessment.status !== "active" || !current.assessment.expiresAt || currentTime.getTime() < new Date(current.assessment.expiresAt).getTime()) return current;
        const expired = { ...current, assessment: { ...current.assessment, status: "expired" as const } };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expired)); return expired;
      });
    }, 1000);
    const sync = () => setState(readState()); window.addEventListener("storage", sync); window.addEventListener("focus", sync);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);

  const update = (next: PersistedAppState) => { setState(next); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const startTest = () => {
    if (state.assessment.status !== "idle") { setSection("test"); return; }
    const startedAt = new Date();
    update({ ...state, assessment: { status: "active", startedAt: startedAt.toISOString(), expiresAt: new Date(startedAt.getTime() + DAY).toISOString(), answers: {}, completedBlocks: [] } });
    setSection("test");
  };

  let content: React.ReactNode;
  if (section === "test") content = <TestScreen state={state} now={now} update={update} startTest={startTest} />;
  else if (section === "academy") content = <AcademyScreen state={state} now={now} update={update} />;
  else if (section === "library") content = <LibraryScreen />;
  else if (section === "profile") content = <ProfileScreen profile={profile} state={state} />;
  else content = <HomeScreen profile={profile} state={state} now={now} go={setSection} startTest={startTest} />;

  if (!hydrated) return <main className="app-shell loading-shell"><div className="loading-mark">HP</div><p>Открываем HOMEPOINT</p></main>;
  return <main className="app-shell"><TopBar profile={profile} onProfile={() => setSection("profile")} /><div className="app-content" key={section}>{content}</div><BottomNav active={section} onChange={setSection} /></main>;
}
