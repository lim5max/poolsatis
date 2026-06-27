# Poolstatis

**Agent-native продуктовая аналитика.** Лёгкий аналог PostHog, в котором основной пользователь — не человек в UI, а кодинг-агент через MCP.

Ключевая идея: метрики в платформе рождаются **вместе с семантикой** — каждая метрика регистрируется с ответом на вопрос «зачем она собирается» и местом в воронке. Это делает инсайты вычислимыми, а инструментацию — проверяемой.

## Как это работает

1. Кодинг-агент по нашему стандарту инструментации расставляет метрики в коде продукта и регистрирует их в Poolstatis через MCP.
2. Продукт шлёт события и сущности по HTTP в наш ингест.
3. Данные живут у нас; владелец продукта строит дашборды и получает инсайты тоже через MCP — без захода на платформу.

## Документация

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Обзор системы, компоненты, принципы |
| [docs/01-data-model.md](docs/01-data-model.md) | Тенантность, типы данных, схемы таблиц |
| [docs/02-storage.md](docs/02-storage.md) | Хранилище: Postgres → ClickHouse, путь миграции |
| [docs/03-mcp-server.md](docs/03-mcp-server.md) | Спецификация MCP-сервера: тулы и ресурсы |
| [docs/04-http-api.md](docs/04-http-api.md) | Ингест и Query API |
| [docs/05-gap-analysis.md](docs/05-gap-analysis.md) | Что есть vs PostHog и приоритеты следующих волн |
| [docs/06-instrumenting-a-product.md](docs/06-instrumenting-a-product.md) | Как занести метрики в продукт (агент/MCP или вручную) |
| [docs/07-vps-deployment.md](docs/07-vps-deployment.md) | Как раскладывать Platform API, MCP, SDK и skills при деплое |
| [sdk/README.md](sdk/README.md) | `@poolstatis/sdk` — клиент для продукта (батчинг, ретраи, flush на unload) |
| [.claude/skills/poolstatis-instrument](.claude/skills/poolstatis-instrument/SKILL.md) | Skill: процедура инструментации продукта агентом |

## Быстрый старт

1. Открой hosted admin, войди через workspace auth и создай первый проект в onboarding.
2. Сохрани одноразовый `pt_` для MCP-клиента и `pk_` для ingest.
3. Добавь MCP-сервер в Claude Code, Claude Desktop, Codex, Cursor, Warp, Windsurf, VS Code/Copilot, Cline, Zed, Continue, Replit, OpenCode, Hermes-style launcher или другой MCP host:

```json
{
  "mcpServers": {
    "poolstatis": {
      "command": "pnpm",
      "args": ["--silent", "dlx", "@poolstatis/mcp"],
      "env": { "POOLSTATIS_URL": "https://api.poolstatis.com", "POOLSTATIS_TOKEN": "pt_…" }
    }
  }
}
```

`--silent` обязателен: pnpm иначе печатает баннер в stdout и ломает протокол stdio.
До публикации `@poolstatis/mcp` этот JSON является publish-ready template; в hosted deploy включай copy-paste flow только после настройки реального MCP runner command/args.

Отправка событий из продукта:

```bash
curl -X POST https://api.poolstatis.com/i/v1/events \
  -H 'Authorization: Bearer pk_…' -H 'content-type: application/json' \
  -d '{"events":[{"event":"signup.completed","distinct_id":"u1"}]}'
```

Локальный запуск остаётся внутренним dev/workflow для контрибьюторов, но публичный продуктовый путь — hosted admin + MCP client setup.

## Админка платформы

`web/` — минимальная **headless-админка** (не дашборд продукта: аналитику клиент строит у себя через MCP). Таблицы: проекты, реестр метрик (с активацией/депрекейтом с причиной), данные (health/события/сущности), API-ключи (выпуск/отзыв), onboarding и вкладка **Setup & MCP** с готовыми пресетами для Claude, Codex, Cursor, Warp, Windsurf, VS Code/Copilot, Cline, Zed, Continue, Replit, OpenCode, Hermes-style launchers и custom MCP.

В hosted-режиме вход идёт через Auth0/OIDC. Scoped keys (`pk_`, `sk_`, `pt_`) остаются для продукта, CI и MCP-клиентов.

## Статус

Реализовано: ингест, реестр метрик с семантикой, воронки, сущности, Query DSL
(**trend / funnel / entities / retention / lifecycle / stickiness**), MCP-сервер
с typed tools/resources, headless-админка, стандарт инструментации и
[skill](.claude/skills/poolstatis-instrument/SKILL.md) для агентов. Следующая волна (см. [docs/05-gap-analysis.md](docs/05-gap-analysis.md)):
actor-merge/identity, статические когорты, feature flags + эксперименты, funnel-correlation.
