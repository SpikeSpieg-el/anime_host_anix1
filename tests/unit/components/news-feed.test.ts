import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsFeed } from "@/components/news/news-feed";
import type { NewsFeedItem } from "@/lib/news/types";

const initialItems: NewsFeedItem[] = [
  {
    id: "1",
    title: "Первая новость",
    excerpt: "Текст первой новости",
    date: "05.11.2026",
    dateTimestamp: Date.UTC(2026, 10, 5),
    author: "Редакция",
    url: "https://weeb-x.com/news/1",
    source: "custom",
  },
  {
    id: "2",
    title: "Вторая новость",
    excerpt: "Текст второй новости",
    date: "05.11.2026",
    dateTimestamp: Date.UTC(2026, 10, 5, 10),
    author: "Редакция",
    url: "https://weeb-x.com/news/2",
    source: "shikimori",
  },
];

const nextPage = {
  items: [
    {
      id: "3",
      title: "Подгруженная новость",
      excerpt: "Текст подгруженной новости",
      date: "04.11.2026",
      dateTimestamp: Date.UTC(2026, 10, 4),
      author: "MAL",
      url: "https://weeb-x.com/news/3",
      source: "jikan",
    },
  ],
  hasNextPage: false,
  page: 2,
  limit: 12,
};

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  root: Element | null = null;
  rootMargin = "";
  thresholds: number[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    // Сразу сообщаем «элемент виден» — так проверяем авто-подгрузку.
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe("NewsFeed", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(nextPage), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("подгружает следующую порцию и не показывает счётчик комментариев", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(NewsFeed, {
          initialItems,
          initialHasNextPage: true,
          pageSize: 12,
        }),
      );
    });

    // Два initial-элемента, счётчика комментариев нет.
    expect(container.textContent).toContain("Первая новость");
    expect(container.textContent).toContain("Вторая новость");
    expect(container.textContent).not.toMatch(/\b61\b/);

    // Observer сообщил «виден» → лента должна подгрузить следующую порцию.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Подгруженная новость");
    expect(container.textContent).toContain("Вы дошли до конца ленты");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
