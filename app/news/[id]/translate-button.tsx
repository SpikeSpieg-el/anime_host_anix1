'use client';

import { useState, useRef } from 'react';
import { Languages, Loader2, RotateCcw } from 'lucide-react';

interface TranslateButtonProps {
  title: string;
  excerpt: string;
  htmlBody?: string;
}

interface TextNodeEntry {
  node: Text;
  original: string;
}

function collectTextNodes(root: Element): TextNodeEntry[] {
  const entries: TextNodeEntry[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Skip script, style, and link elements
      const tag = parent.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'a') return NodeFilter.FILTER_REJECT;
      const text = node.textContent?.trim();
      if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    entries.push({ node: textNode, original: textNode.textContent || '' });
  }
  return entries;
}

async function translateBatch(texts: string[]): Promise<string[]> {
  // Join with a unique separator that won't appear in normal text
  const separator = '\n@@SEP@@\n';
  const combined = texts.join(separator);

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: combined, source: 'en', target: 'ru' }),
    });
    if (!res.ok) throw new Error('Translate failed');
    const data = await res.json();
    const translated = data.translated as string;
    // Split back by separator — Google Translate usually preserves newlines
    const parts = translated.split(/\n?@@SEP@@\n?/);
    // If split didn't work well, fall back to per-text translation
    if (parts.length === texts.length) {
      return parts;
    }
  } catch {}

  // Fallback: translate individually
  return Promise.all(texts.map(async (t) => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, source: 'en', target: 'ru' }),
      });
      if (!res.ok) return t;
      const data = await res.json();
      return data.translated as string;
    } catch {
      return t;
    }
  }));
}

export function TranslateButton({ title, excerpt, htmlBody }: TranslateButtonProps) {
  const [isTranslated, setIsTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedNodesRef = useRef<TextNodeEntry[]>([]);
  const savedTitleRef = useRef<string>('');

  async function handleTranslate() {
    if (isTranslated) {
      restoreOriginal();
      setIsTranslated(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const main = containerRef.current?.closest('main');
      if (!main) return;

      // Collect all text to translate
      const textsToTranslate: string[] = [];

      // 1. Title
      const titleEl = main.querySelector('[data-news-title]');
      if (titleEl) {
        savedTitleRef.current = titleEl.textContent || '';
        textsToTranslate.push(titleEl.textContent || '');
      }

      // 2. Body text nodes (htmlBody case) or excerpt text
      const bodyDiv = main.querySelector('.shikimori-news-body');
      const excerptP = main.querySelector('.news-excerpt-text');

      let bodyEntries: TextNodeEntry[] = [];
      if (bodyDiv) {
        bodyEntries = collectTextNodes(bodyDiv);
        savedNodesRef.current = bodyEntries;
        for (const entry of bodyEntries) {
          textsToTranslate.push(entry.original);
        }
      } else if (excerptP) {
        savedNodesRef.current = [{
          node: excerptP.firstChild as Text,
          original: excerptP.textContent || '',
        }];
        textsToTranslate.push(excerptP.textContent || '');
      }

      if (textsToTranslate.length === 0) return;

      // Translate all texts in one batch
      const translations = await translateBatch(textsToTranslate);

      // Apply translations to DOM
      let idx = 0;
      if (titleEl && translations[idx]) {
        titleEl.textContent = translations[idx];
      }
      idx++;

      for (const entry of bodyEntries) {
        if (translations[idx]) {
          entry.node.textContent = translations[idx];
        }
        idx++;
      }

      // Handle excerpt case (single text node)
      if (!bodyDiv && excerptP && translations[idx]) {
        excerptP.textContent = translations[idx];
      }

      setIsTranslated(true);
    } catch {
      setError('Не удалось перевести. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  function restoreOriginal() {
    const main = containerRef.current?.closest('main');
    if (!main) return;

    const titleEl = main.querySelector('[data-news-title]');
    if (titleEl && savedTitleRef.current) {
      titleEl.textContent = savedTitleRef.current;
    }

    for (const entry of savedNodesRef.current) {
      if (entry.node) {
        entry.node.textContent = entry.original;
      }
    }

    savedNodesRef.current = [];
    savedTitleRef.current = '';
  }

  return (
    <div ref={containerRef} className="contents">
      <button
        onClick={handleTranslate}
        disabled={loading}
        className="news-translate-btn"
        title={isTranslated ? 'Вернуть оригинал' : 'Перевести на русский'}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Перевод...
          </>
        ) : isTranslated ? (
          <>
            <RotateCcw className="w-4 h-4" />
            Оригинал
          </>
        ) : (
          <>
            <Languages className="w-4 h-4" />
            Перевести
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
