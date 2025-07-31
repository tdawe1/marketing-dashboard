CREATE TABLE metric_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'integration')),
  platform TEXT CHECK (platform IN ('google-analytics', 'google-ads', 'facebook-ads', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('active', 'processing', 'error')) DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_analyzed TIMESTAMP WITH TIME ZONE,
  row_count INTEGER,
  date_range_start DATE,
  date_range_end DATE
);

CREATE TABLE unified_metrics (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES metric_sources(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('count', 'rate', 'currency', 'duration')),
  category TEXT NOT NULL CHECK (category IN ('traffic', 'engagement', 'conversion', 'revenue', 'advertising')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unified_metrics_source_date ON unified_metrics(source_id, date);
CREATE INDEX idx_unified_metrics_metric_name ON unified_metrics(metric_name);
CREATE INDEX idx_unified_metrics_date_range ON unified_metrics(date);
CREATE INDEX idx_unified_metrics_category ON unified_metrics(category);
