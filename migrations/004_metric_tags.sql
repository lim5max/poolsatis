-- Free-form tags on metrics: an open facet alongside the curated AARRR category
-- (e.g. 'product', 'north-star', 'performance'). Lowercased/deduped by the service.
ALTER TABLE metrics ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX metrics_tags_gin ON metrics USING gin (tags);
