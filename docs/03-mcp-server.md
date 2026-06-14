# MCP-сервер

Точка входа для агентов. Тонкая обёртка над Platform API: никакой бизнес-логики в самом MCP — он маппит тулы на REST-вызовы и отдаёт ресурсы. Авторизация: personal token (`pt_…`) в конфиге MCP, скоуп — один или несколько проектов.

Два режима использования одним и тем же сервером:

- **Design-time** (агент инструментирует продукт): читает стандарт, регистрирует метрики и воронки.
- **Analysis-time** (агент отвечает на вопросы владельца): выполняет запросы, строит дашборды у себя, читает инсайты.

## Ресурсы (MCP resources)

| URI | Содержание |
|-----|------------|
| `poolsatis://standard/instrumentation` | Стандарт инструментации: именование событий, обязательные свойства, какие метрики ставить по типу продукта. Версионируется. (Контент — этап 2.) |
| `poolsatis://{project}/schema` | Живая схема проекта: метрики реестра, воронки, типы сущностей, фактические имена событий за 30 дней с пометкой registered/unregistered. |

Схема как ресурс — ключевой UX-ход: агент получает полный контекст проекта одним чтением, без цепочки list-вызовов.

## Тулы

### Контекст

```
list_projects()                      → [{slug, name, env_list, events_30d}]
get_project_schema(project)          → то же, что ресурс schema (для клиентов без resources)
```

### Реестр (design-time)

```
register_metric(project, {key, name, purpose, category, type, source})
  → {id, status: 'proposed'}
  // purpose обязателен; сервер отклоняет пустой/шаблонный ("tracks clicks") текст

update_metric(project, key, patch)   // включая активацию: {status: 'active'}
list_metrics(project, {status?, category?})

register_entity_type(project, {name, description, prop_schema?})

define_funnel(project, {key, name, goal, steps: [{metric_key, label}], window_seconds})
list_funnels(project)
```

### Запросы (analysis-time)

Все запросы — Query DSL, транслируемый в `EventStore.trend/funnel` (см. [04-http-api.md](04-http-api.md)):

```
query_trend(project, {metric, date_from, date_to?, interval, breakdown?, env?})
  → {series: [{bucket, value, breakdown_value?}]}

query_funnel(project, {funnel | steps, date_from, date_to?, env?})
  → {steps: [{label, actors, conversion_from_prev, conversion_from_start}]}

query_entities(project, {entity_type, filters?, limit, order_by?})
  → {entities: [{entity_id, properties, updated_at}]}

sample_events(project, {event?, registered?, limit≤100})
  → последние события: отладка инструментации ("дошло ли событие?")
```

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
4. **Запись метаданных безопасна по умолчанию.** Всё, что создаёт агент, рождается `proposed`; активация — отдельное действие, которое владелец может оставить за собой.

## Транспорт

MVP: stdio-сервер (npm-пакет `poolsatis-mcp`, токен в env) — покрывает Claude Code/Desktop и большинство IDE. Streamable HTTP — этап 3, когда появится hosted-вариант.
