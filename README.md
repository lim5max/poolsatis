# Poolstatis

**Agent-native продуктовая аналитика.** Лёгкий аналог PostHog, в котором основной пользователь — не человек в UI, а кодинг-агент через MCP.

Ключевая идея: метрики в платформе рождаются **вместе с семантикой** — каждая метрика регистрируется с ответом на вопрос «зачем она собирается» и местом в воронке. Это делает инсайты вычислимыми, а инструментацию — проверяемой.

## Как это работает

1. Агент (Claude и др.) по нашему стандарту инструментации расставляет метрики в коде продукта и регистрирует их в Poolstatis через MCP.
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

Требуется Node 22+, pnpm и Docker.

```bash
pnpm install
docker compose up -d            # Postgres на localhost:5444
pnpm bootstrap "My Org" my-app "My App"   # печатает токены — сохрани их
pnpm serve                      # Platform + Ingest API на :3300
```

Подключение MCP-сервера к агенту (Claude Code):

```json
{
  "mcpServers": {
    "poolstatis": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/path/to/poolstatis", "mcp"],
      "env": { "POOLSTATIS_URL": "http://127.0.0.1:3300", "POOLSTATIS_TOKEN": "pt_…" }
    }
  }
}
```

`--silent` обязателен: pnpm иначе печатает баннер в stdout и ломает протокол stdio.

Проверка MCP без ручного клиента:

```bash
POOLSTATIS_TOKEN=pt_… pnpm mcp:smoke --project my-app
```

Отправка событий из продукта:

```bash
curl -X POST localhost:3300/i/v1/events \
  -H 'Authorization: Bearer pk_…' -H 'content-type: application/json' \
  -d '{"events":[{"event":"signup.completed","distinct_id":"u1"}]}'
```

Демо-данные для проб: `pnpm seed demo` (260 юзеров, ~5k событий за 12 недель — печатает токены).

Тесты: `pnpm test` (нужен поднятый Docker-Postgres).

## Админка платформы

`web/` — минимальная **headless-админка** (не дашборд продукта: аналитику клиент строит у себя через MCP). Таблицы: проекты, реестр метрик (с активацией/депрекейтом), данные (health/события/сущности), API-ключи (выпуск/отзыв) и вкладка **Setup & MCP** с готовым конфигом подключения.

```bash
pnpm --dir web install
pnpm --dir web dev        # админка на :5273, dev-прокси к :3300
```

Вход — secret-ключ (`sk_`, один проект) или personal-токен (`pt_`, вся орг).

## Статус

Реализовано: ингест, реестр метрик с семантикой, воронки, сущности, Query DSL
(**trend / funnel / entities / retention / lifecycle / stickiness**), MCP-сервер
с typed tools/resources, headless-админка, стандарт инструментации и
[skill](.claude/skills/poolstatis-instrument/SKILL.md) для агентов. Следующая волна (см. [docs/05-gap-analysis.md](docs/05-gap-analysis.md)):
actor-merge/identity, статические когорты, feature flags + эксперименты, funnel-correlation.
