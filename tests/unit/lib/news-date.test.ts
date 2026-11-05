import { describe, expect, it, vi } from "vitest";
import {
  formatNewsDateLabel,
  getMoscowDateKey,
  getNewsDateKey,
  newsDateToIsoDate,
  parseNewsTimestamp,
  pluralizeNews,
} from "@/lib/news/date";

describe("news dates", () => {
  it("разбирает ДД.ММ.ГГГГ как UTC-полночь, а не как локальную дату", () => {
    expect(parseNewsTimestamp("05.11.2026")).toBe(Date.UTC(2026, 10, 5));
    // В часовом поясе UTC−5 наивный new Date('2026-11-05') дал бы 4 ноября.
    expect(new Date(parseNewsTimestamp("05.11.2026")).getUTCDate()).toBe(5);
  });

  it("возвращает стабильный ключ группировки", () => {
    expect(getNewsDateKey("05.11.2026")).toBe("05.11.2026");
    expect(getNewsDateKey("5.11.2026")).toBe("05.11.2026");
    expect(getNewsDateKey(Date.UTC(2026, 10, 5))).toBe("05.11.2026");
  });

  it("отдаёт дату для <time datetime> без времени и сдвигов TZ", () => {
    expect(newsDateToIsoDate("05.11.2026")).toBe("2026-11-05");
    expect(newsDateToIsoDate(Date.UTC(2026, 10, 5, 23, 30))).toBe("2026-11-05");
  });

  it("подписывает сегодня/вчера по Москве", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z")); // 15:00 в Москве

    expect(getMoscowDateKey(0)).toBe("05.11.2026");
    expect(getMoscowDateKey(-1)).toBe("04.11.2026");
    expect(formatNewsDateLabel("05.11.2026")).toBe("Сегодня");
    expect(formatNewsDateLabel("04.11.2026")).toBe("Вчера");
    expect(formatNewsDateLabel("01.11.2026")).toContain("1 ноября 2026");

    vi.useRealTimers();
  });

  it("склоняет счётчик новостей", () => {
    expect(pluralizeNews(1)).toBe("1 новость");
    expect(pluralizeNews(2)).toBe("2 новости");
    expect(pluralizeNews(5)).toBe("5 новостей");
    expect(pluralizeNews(11)).toBe("11 новостей");
    expect(pluralizeNews(12)).toBe("12 новостей");
    expect(pluralizeNews(14)).toBe("14 новостей");
    expect(pluralizeNews(21)).toBe("21 новость");
    expect(pluralizeNews(22)).toBe("22 новости");
  });
});
