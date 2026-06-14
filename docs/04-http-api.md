# HTTP API

Два публичных контура с разными ключами:

| Контур | Базовый путь | Авторизация | Назначение |
|--------|--------------|-------------|------------|
| Ingest | `/i/v1/*` | `pk_…` (ingest key) | запись событий/сущностей из продукта |
| Platform | `/api/v1/*` | `sk_…` / `pt_…` | метаданные + запросы (то, что зовёт MCP) |

## Ingest API

### POST /i/v1/events

```jsonc
// Authorization: Bearer pk_…   (ключ определяет project и env)
{
  "batch_id": "uuid-от-клиента",        // идемпотентность: повтор батча не дублирует события
  "events": [
    {
      "event": "checkout.completed",
      "timestamp": "2026-06-13T10:21:03.120Z",  // опционально, default = время приёма
      "distinct_id": "user_8a21",
      "session_id": "s_b1f0",                    // опционально
      "properties": { "amount": 49.0, "plan": "pro" }
    }
  ]
}
// → 200 { "accepted": 1, "unregistered": 0 }
```

Правила приёма:

- Батч ≤ 500 событий, тело ≤ 1 МБ. Ответ всегда быстрый: валидация синхронная, но лёгкая.
- `timestamp` из будущего (> +5 мин) или старше ретеншна → заменяется на `ingested_at`, событие помечается `$clock_skew: true`.
- Сверка с реестром: имя события входит в `source.event` какой-либо `active`-метрики → `registered = true`. Иначе событие **принимается** с `registered = false` — счётчик `unregistered` в ответе даёт SDK/агенту мгновенный сигнал о расхождении со стандартом.
- Невалидные события (нет `event`/`distinct_id`) не валят батч: ответ `207` с поэлементными ошибками.

### POST /i/v1/entities

```jsonc
{
  "entities": [
    {
      "entity_type": "account",
      "entity_id": "acc_42",
      "properties": { "plan": "pro", "seats": 7, "trial": null }  // null удаляет ключ
    }
  ]
}
// → 200 { "upserted": 1 }
```

Merge-семантика: присланные ключи перезаписывают существующие, отсутствующие сохраняются.

## Platform API

CRUD-слой 1:1 с тулами MCP (см. [03-mcp-server.md](03-mcp-server.md)):

```
GET    /api/v1/projects
GET    /api/v1/projects/{slug}/schema
POST   /api/v1/projects/{slug}/metrics
PATCH  /api/v1/projects/{slug}/metrics/{key}
GET    /api/v1/projects/{slug}/metrics
POST   /api/v1/projects/{slug}/entity-types
POST   /api/v1/projects/{slug}/funnels
GET    /api/v1/projects/{slug}/funnels
POST   /api/v1/projects/{slug}/query          ← единая точка Query DSL
GET    /api/v1/projects/{slug}/events/sample
GET    /api/v1/projects/{slug}/insights
POST   /api/v1/projects/{slug}/insights
```

## Query DSL

Один POST `/query`, дискриминатор — `kind`. DSL невелик по построению: он обязан транслироваться в узкий интерфейс `EventStore` (см. [02-storage.md](02-storage.md)).

```jsonc
// Временной ряд по метрике реестра
{
  "kind": "trend",
  "metric": "checkout_revenue",          // key из реестра — семантика уже в нём
  "date_from": "-30d",                   // относительные и ISO-даты
  "date_to": null,
  "interval": "day",                     // hour | day | week | month
  "breakdown": { "property": "plan" },   // опционально, топ-10 значений + other
  "env": "prod"
}

// Воронка
{
  "kind": "funnel",
  "funnel": "activation",                // либо inline: "steps": [{"metric":"signup"}, …]
  "date_from": "-14d",
  "env": "prod"
}

// Сущности
{
  "kind": "entities",
  "entity_type": "account",
  "filters": [{ "property": "plan", "op": "eq", "value": "pro" }],
  "order_by": { "property": "seats", "dir": "desc" },
  "limit": 50
}
```

Операторы фильтров: `eq, ne, gt, gte, lt, lte, in, contains, is_set, is_not_set`.

Ответ любого запроса включает `meta`: `{computed_at, date_range, sampling: null}` — задел под кеширование и сэмплирование без смены контракта.

Принципиально: **trend и funnel принимают только ключи метрик реестра**, не сырые имена событий. Хочешь график — зарегистрируй метрику (с purpose). Это та самая воронка принуждения к семантике, на которой стоит платформа; исключение — `sample_events` для отладки.

## Лимиты и ошибки

- Rate limit: ингест 1000 событий/с на проект (burst 5000), Platform API 60 rps на ключ. Ответ `429` с `Retry-After`.
- Формат ошибок единый: `{ "error": { "code": "metric_key_taken", "message": "…", "hint": "…" } }` — `hint` пишется для агента-читателя.
