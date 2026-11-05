import { beforeEach, describe, expect, it, vi } from "vitest";

const { getForumNewsPaginated, getJikanNews } = vi.hoisted(() => ({
  getForumNewsPaginated: vi.fn(),
  getJikanNews: vi.fn(),
}));
vi.mock("@/lib/shikimori", () => ({ getForumNewsPaginated, getNewsById: vi.fn() }));
vi.mock("@/lib/jikan/api", () => ({ getJikanNews, getJikanNewsById: vi.fn() }));

import { getAggregatedNews } from "@/lib/news/aggregator";

function shiki(id: number) {
  return { id: String(id), title: `News ${id}`, excerpt: "", date: "05.11.2026", author: "Author", comments: 0, url: `https://shikimori.one/${id}` };
}

describe("news aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    getJikanNews.mockResolvedValue([]);
  });

  it("uses the same Shikimori page size when Jikan is disabled on later pages", async () => {
    getForumNewsPaginated.mockImplementation(async (page: number, limit: number) =>
      Array.from({ length: limit }, (_, i) => shiki((page - 1) * limit + i + 1)));
    const first = await getAggregatedNews(1, 12);
    const second = await getAggregatedNews(2, 12, { includeJikan: false });
    expect(getForumNewsPaginated.mock.calls).toEqual([[1, 4], [2, 4]]);
    expect([...first.items, ...second.items].map(item => item.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("shows and marks the Shikimori snapshot even if MAL is available", async () => {
    getForumNewsPaginated.mockResolvedValue([]);
    getJikanNews.mockResolvedValue([{ ...shiki(9), id: "jikan-9" }]);
    const result = await getAggregatedNews(1, 12);
    expect(result.isFallback).toBe(true);
    expect(result.items.some(item => item.source === "shikimori")).toBe(true);
    expect(result.items.some(item => item.source === "jikan")).toBe(true);
  });
});
