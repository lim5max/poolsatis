# Poolsatis

**Agent-native продуктовая аналитика.** Лёгкий аналог PostHog, в котором основной пользователь — не человек в UI, а кодинг-агент через MCP.

Ключевая идея: метрики в платформе рождаются **вместе с семантикой** — каждая метрика регистрируется с ответом на вопрос «зачем она собирается» и местом в воронке. Это делает инсайты вычислимыми, а инструментацию — проверяемой.

## Как это работает

1. Агент (Claude и др.) по нашему стандарту инструментации расставляет метрики в коде продукта и регистрирует их в Poolsatis через MCP.
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
    "poolsatis": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/path/to/poolsatis", "mcp"],
      "env": { "POOLSATIS_TOKEN": "pt_…" }
    }
  }
}
```

`--silent` обязателен: pnpm иначе печатает баннер в stdout и ломает протокол stdio.

Отправка событий из продукта:

```bash
curl -X POST localhost:3300/i/v1/events \
  -H 'Authorization: Bearer pk_…' -H 'content-type: application/json' \
  -d '{"events":[{"event":"signup.completed","distinct_id":"u1"}]}'
```

Тесты: `pnpm test` (нужен поднятый Docker-Postgres).

## Статус

MVP реализован: ингест, реестр метрик, воронки, сущности, Query DSL (trend/funnel/entities), MCP-сервер с 15 тулами. Следующий этап — полный стандарт инструментации и Insights Worker (см. ARCHITECTURE.md, раздел «Дорожная карта»).
