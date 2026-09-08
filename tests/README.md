# Tests

Кратко. Полная инструкция: **[docs/TESTING.md](../docs/TESTING.md)**.

```bash
npm test                 # unit + API inventory
npm run test:watch       # watch
npm run test:e2e         # Playwright (нужен Chromium: npm run test:e2e:install)
```

Новая страница или API → запись в `tests/registry/`, иначе CI красный.  
Новая фича → скопировать `tests/templates/new-feature.test.template.ts`.
