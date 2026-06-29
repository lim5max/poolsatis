# Poolstatis

**Agent-native продуктовая аналитика.** Лёгкий аналог PostHog, в котором основной пользователь — не человек в UI, а кодинг-агент через MCP.

Ключевая идея: метрики в платформе рождаются **вместе с семантикой** — каждая метрика регистрируется с ответом на вопрос «зачем она собирается» и местом в воронке. Это делает инсайты вычислимыми, а инструментацию — проверяемой.

## Source available

Poolstatis опубликован как source-available под [PolyForm Shield License 1.0.0](LICENSE): core можно читать, запускать и менять для разрешенных сценариев, но нельзя продавать Poolstatis как конкурирующий продукт или предоставлять его как competing hosted/managed service. Правила участия: [CONTRIBUTING.md](CONTRIBUTING.md), security flow: [SECURITY.md](SECURITY.md), release checklist: [docs/09-source-available-release.md](docs/09-source-available-release.md).

Этот repo теперь только про систему: backend, ingest, MCP, SDK, admin SPA, migrations, technical docs и Docker self-host. Публичный лендинг/docs/waitlist вынесены в отдельный локальный repo: `/Users/maksimstil/Desktop/poolsatis-site`.

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
| [docs/09-source-available-release.md](docs/09-source-available-release.md) | Как вести source-available релиз и GitHub hygiene |
| [docs/10-self-host.md](docs/10-self-host.md) | Самый короткий self-host путь через Docker Compose |
| [docs/11-repository-split.md](docs/11-repository-split.md) | Границы system/site/cloud репозиториев |
| [sdk/README.md](sdk/README.md) | `@poolstatis/sdk` — клиент для продукта (батчинг, ретраи, flush на unload) |
| [.claude/skills/poolstatis-instrument](.claude/skills/poolstatis-instrument/SKILL.md) | Skill: процедура инструментации продукта агентом |

## Локальная разработка

```bash
docker compose up -d
pnpm install
pnpm migrate
pnpm bootstrap "Poolstatis" poolstatis "Local project"
pnpm serve
pnpm --dir web dev
```

Перед PR по backend/shared logic запускай `pnpm typecheck && pnpm test`. Перед изменениями админки запускай `pnpm --dir web build`. Публичный сайт меняется в `/Users/maksimstil/Desktop/poolsatis-site`.

## Self-host за 3 команды

```bash
docker compose -f docker-compose.selfhost.yml up -d --build
curl http://localhost:3300/health
docker compose -f docker-compose.selfhost.yml run --rm poolstatis \
  node dist/cli/bootstrap.js "Acme" acme "Acme Product"
```

Потом открой `http://localhost:8080` и вставь напечатанный `sk_` или `pt_` токен.
Полная инструкция: [docs/10-self-host.md](docs/10-self-host.md).

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
