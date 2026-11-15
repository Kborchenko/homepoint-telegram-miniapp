import {
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  Headphones,
  MessageCircleMore,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type AssessmentQuestion = {
  id: string;
  question: string;
  hint: string;
  options: string[];
  correct: number;
};

export const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: "new-order-status",
    question: "Покупатель оформил заказ на сайте HOMEPOINT. Какой статус должен быть у заказа, который только что появился в системе?",
    hint: "Заказ ещё не передан в обработку.",
    options: ["Новый", "Собран", "Передан в доставку", "Завершён"],
    correct: 0,
  },
  {
    id: "missing-stock",
    question: "Во время подтверждения выяснилось, что одного товара нет в наличии. Что сделать в первую очередь?",
    hint: "Клиенту нужен понятный следующий шаг, а не обещание без проверки.",
    options: ["Удалить товар молча", "Уточнить замену или изменение заказа", "Отменить весь заказ", "Передать заказ курьеру"],
    correct: 1,
  },
  {
    id: "delivery-delay",
    question: "Доставка задерживается. Какой ответ клиенту будет профессиональным?",
    hint: "Используйте только подтверждённую информацию.",
    options: ["Обещать доставку через час", "Не отвечать до завершения доставки", "Сообщить подтверждённый статус и следующий шаг", "Сослаться на курьера"],
    correct: 2,
  },
  {
    id: "client-tone",
    question: "Клиент пишет эмоционально и требует срочного решения. Как начать ответ?",
    hint: "Сначала покажите, что ситуация понята.",
    options: ["Попросить писать спокойнее", "Коротко признать проблему и уточнить детали", "Сразу закрыть диалог", "Отправить шаблон без контекста"],
    correct: 1,
  },
  {
    id: "shift-handoff",
    question: "Смена заканчивается, а вопрос клиента ещё не решён. Что обязательно сохранить при передаче?",
    hint: "Следующий сотрудник не должен начинать разговор заново.",
    options: ["Только имя клиента", "Только номер заказа", "Контекст, выполненные действия и открытый вопрос", "Скриншот последнего сообщения"],
    correct: 2,
  },
];

export type TrainingDay = {
  day: number;
  title: string;
  summary: string;
  duration: string;
  lessons: number;
  icon: LucideIcon;
  accent: string;
};

export const trainingDays: TrainingDay[] = [
  { day: 1, title: "Знакомство с работой", summary: "Роль координатора, путь заказа и стандарты HOMEPOINT.", duration: "45 мин", lessons: 5, icon: BadgeCheck, accent: "sage" },
  { day: 2, title: "Карточки товаров", summary: "Характеристики, комплектация, материалы и честная консультация.", duration: "55 мин", lessons: 6, icon: Boxes, accent: "sand" },
  { day: 3, title: "Обработка заказов", summary: "Статусы, подтверждение, изменения и фиксация договорённостей.", duration: "60 мин", lessons: 6, icon: ClipboardCheck, accent: "clay" },
  { day: 4, title: "Склад и остатки", summary: "Проверка наличия, резервы, замены и работа с расхождениями.", duration: "50 мин", lessons: 5, icon: PackageCheck, accent: "sage" },
  { day: 5, title: "Доставка и статусы", summary: "Маршрут заказа, сроки, переносы и информирование клиента.", duration: "55 мин", lessons: 6, icon: Truck, accent: "sand" },
  { day: 6, title: "Общение с клиентами", summary: "Тон, сложные ситуации, границы обещаний и решение вопросов.", duration: "65 мин", lessons: 7, icon: MessageCircleMore, accent: "clay" },
  { day: 7, title: "Организация смены", summary: "Приоритеты, передача дел и финальное комплексное тестирование.", duration: "75 мин", lessons: 8, icon: Headphones, accent: "sage" },
];

export const references = [
  { type: "Регламент", title: "Карта статусов заказа", meta: "Обновлено сегодня", tone: "green" },
  { type: "Товарная база", title: "Коллекции HOMEPOINT", meta: "24 карточки", tone: "cream" },
  { type: "Скрипты", title: "Ответы клиентам", meta: "18 ситуаций", tone: "terracotta" },
  { type: "Чек-лист", title: "Передача смены", meta: "7 обязательных пунктов", tone: "cream" },
  { type: "Инструкция", title: "Работа с доставкой", meta: "Статусы и исключения", tone: "green" },
  { type: "Шпаргалка", title: "Материалы и уход", meta: "12 категорий", tone: "terracotta" },
];

