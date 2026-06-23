# MCP-сервер

Точка входа для агентов. Тонкая обёртка над Platform API: никакой бизнес-логики в самом MCP — он маппит тулы на REST-вызовы и отдаёт ресурсы. Авторизация: personal token (`pt_…`) в конфиге MCP, скоуп — один или несколько проектов.

Два режима использования одним и тем же сервером:

- **Design-time** (агент инструментирует продукт): читает стандарт, регистрирует метрики и воронки.
- **Analysis-time** (агент отвечает на вопросы владельца): выполняет запросы, строит дашборды у себя, читает инсайты.

## Ресурсы (MCP resources)

| URI | Содержание |
|-----|------------|
| `poolstatis://standard/instrumentation` | Стандарт инструментации: именование событий, обязательные свойства, какие метрики ставить по типу продукта. Версионируется. (Контент — этап 2.) |
| `poolstatis://{project}/schema` | Живая схема проекта: метрики реестра, воронки, типы сущностей, фактические имена событий за 30 дней с пометкой registered/unregistered. |

Схема как ресурс — ключевой UX-ход: агент получает полный контекст проекта одним чтением, без цепочки list-вызовов.

## Тулы

### Контекст

```
list_projects()                      → [{slug, name, env_list, events_30d}]
get_project_schema(project)          → то же, что ресурс schema (для клиентов без resources)
```

### Реестр (design-time)

```
register_metric(project, {key, name, purpose, category, tags?, type, source})
  → {id, status: 'proposed'}
  // purpose обязателен; tags — свободные метки (фича/north-star), нормализуются (lowercase, dedupe)

update_metric(project, key, patch)   // включая активацию {status:'active'} и tags
deprecate_metric(project, key, reason)
explain_metric_usage(project, key, {env?, since_days?})
delete_metric(project, key)          // hard delete; отказ, если на метрику ссылается воронка
list_metrics(project, {status?, category?})

register_entity_type(project, {name, description, prop_schema?})

define_funnel(project, {key, name, goal, steps: [{metric_key, label}], window_seconds})
list_funnels(project)
delete_funnel(project, key)
```

### Запросы (analysis-time)

Все запросы — Query DSL за `EventStore` (см. [04-http-api.md](04-http-api.md)):

```
query_trend(project, {metric, date_from, date_to?, interval, breakdown?, env?})
query_funnel(project, {funnel | steps, date_from, date_to?, env?})
  // каждый step возвращает metric_key, purpose, category, actors и conversion_*
query_retention(project, {start_metric, return_metric?, interval, periods, date_from, env?})
query_lifecycle(project, {metric, interval, date_from, env?})   // new/returning/resurrecting/dormant
query_stickiness(project, {metric, interval, date_from, env?})
query_entities(project, {entity_type, filters?, limit, order_by?})

get_person(project, {distinct_id, env?})       // engagement summary + identity entity
sample_events(project, {event?, registered?, distinct_id?, limit≤100})  // отладка ингеста
list_ingest_warnings(project, {env?, kind?})   // rejected/unregistered/clock_skew (лог ошибок)
list_data_quality_issues(project, {env?, limit?, since_days?})
  // semantic conflicts: e.g. brief.completed exists, but entity status is still "new"
```

MCP tools expose structured JSON output (`structuredContent`) with a text JSON fallback for older clients.

### Инсайты

```
list_insights(project, {status?, kind?})
create_insight(project, {title, body, query?})        // kind='manual'
resolve_insight(project, id, {status: 'ack'|'resolved'})
```

## Принципы дизайна тулов

1. **Тул = одно намерение агента.** Не «универсальный query endpoint с 20 параметрами», а отдельные тулы под trend/funnel/entities — так агент реже ошибается в параметрах, а описания тулов короче.
2. **Ошибки учат.** Ответ на невалидный вызов содержит исправление: `register_metric` с занятым key возвращает существующую метрику и подсказку «используй update_metric или другой key». Агент — основной пользователь, и сообщение об ошибке — это его документация.
3. **Ингеста в MCP нет.** События шлёт продукт по HTTP в рантайме, а не агент в чате. Единственное исключение — `sample_events` для проверки, что инструментация работает.
4. **Запись метаданных безопасна по умолчанию.** Всё, что создаёт агент, рождается `proposed`; активация — отдельное действие, которое владелец может оставить за собой. Retirement идёт через `deprecate_metric(reason)`, чтобы следующий агент видел, почему метрика больше не используется.

## Транспорт

MVP: stdio-сервер (npm-пакет `poolstatis-mcp`, токен в env) — покрывает Claude Code/Desktop и большинство IDE. Streamable HTTP — этап 3, когда появится hosted-вариант.
