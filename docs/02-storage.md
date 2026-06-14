# Хранилище

## Два контура

| Контур | Данные | Профиль нагрузки | БД |
|--------|--------|------------------|----|
| Metadata plane | проекты, ключи, реестр метрик, воронки, сущности | мало строк, OLTP, важна консистентность и FK | Postgres (всегда) |
| Data plane | события | append-only, миллионы строк, агрегации по времени | Postgres (MVP) → ClickHouse (этап 3) |

Сущности (entities) живут в metadata plane несмотря на потенциальный объём: они изменяемые (upsert), а колоночные БД плохо переносят update-нагрузку.

## Интерфейс EventStore

Весь код платформы работает с событиями только через адаптер:

```ts
interface EventStore {
  append(events: IngestEvent[]): Promise<void>;

  // Структурированные запросы — ровно те, что нужны Query DSL.
  // Никакого "выполни произвольный SQL" в интерфейсе.
  trend(q: TrendQuery): Promise<TrendResult>;        // временной ряд по метрике
  funnel(q: FunnelQuery): Promise<FunnelResult>;     // конверсии по шагам
  sample(q: SampleQuery): Promise<RawEvent[]>;       // последние N событий (отладка)
  eventNames(projectId: string, env: string): Promise<EventNameStat[]>; // живая схема
}
```

Узкий интерфейс — осознанно: каждый метод реализуем эффективно и в Postgres, и в ClickHouse, и миграция не требует менять ни Platform API, ни MCP.

## MVP: PostgresEventStore

```sql
CREATE TABLE events (
  project_id   uuid NOT NULL,
  env          text NOT NULL,
  event        text NOT NULL,
  timestamp    timestamptz NOT NULL,
  distinct_id  text NOT NULL,
  session_id   text,
  properties   jsonb NOT NULL DEFAULT '{}',
  registered   boolean NOT NULL DEFAULT false,
  ingested_at  timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (timestamp);
-- партиции по месяцу создаются заранее фоновым джобом

CREATE INDEX events_main_idx ON events (project_id, env, event, timestamp);
CREATE INDEX events_actor_idx ON events (project_id, distinct_id, timestamp);
```

Почему этого хватит надолго: один Postgres спокойно держит десятки миллионов событий с такими индексами, а наша ранняя аудитория — вайб-кодед продукты с трафиком, далёким от энтерпрайза. Партиционирование по месяцу даёт дешёвый ретеншн (DROP PARTITION) и не даёт индексам распухнуть.

Воронки в Postgres считаются оконными функциями (первое достижение каждого шага per distinct_id в окне) — для MVP-объёмов это секунды.

## Этап 3: ClickHouseEventStore

```sql
CREATE TABLE events (
  project_id   UUID,
  env          LowCardinality(String),
  event        LowCardinality(String),
  timestamp    DateTime64(3),
  distinct_id  String,
  session_id   Nullable(String),
  properties   String,                -- JSON-строка, доступ через JSONExtract
  registered   UInt8,
  ingested_at  DateTime64(3)
) ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, env, event, timestamp);
```

Триггер миграции — не дата, а симптомы: p95 запроса trend > 2с или таблица событий > ~100 ГБ. Перенос: двойная запись в оба стора → бэкфил партиций → переключение чтения → отключение PG-стора.

## Ингест-путь

MVP: Ingest API пишет в Event Store синхронно, батчами (клиент шлёт массив до 500 событий). Очередь (Kafka/Redpanda) сознательно **не** ставим: на наших объёмах она добавляет операционную сложность без пользы. Точка расширения зафиксирована — `append()` атомарен и идемпотентность обеспечивается на уровне батча (клиентский `batch_id`, дедупликация за последние 24 ч).

## Ретеншн и удаление

- Ретеншн настраивается per project (по умолчанию 12 месяцев) → DROP PARTITION / TTL в CH.
- GDPR-удаление: `DELETE WHERE project_id = ? AND distinct_id = ?` — в Postgres тривиально, в CH через lightweight delete. Сущности удаляются строкой из `entities`.
