CREATE TABLE scheduled_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('google-analytics', 'google-ads', 'facebook-ads')),
  account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  time_of_day TIME NOT NULL DEFAULT '09:00:00',
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metrics TEXT[], -- JSON array of metrics to fetch
  dimensions TEXT[], -- JSON array of dimensions to fetch
  notification_email TEXT,
  auto_analyze BOOLEAN NOT NULL DEFAULT TRUE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('insights', 'recommendations', 'summary')) DEFAULT 'insights'
);

CREATE TABLE job_executions (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  file_id TEXT,
  analysis_id TEXT,
  rows_fetched INTEGER,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE TABLE historical_analyses (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  execution_id BIGINT NOT NULL REFERENCES job_executions(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  total_rows INTEGER NOT NULL,
  key_metrics JSONB,
  insights_count INTEGER NOT NULL DEFAULT 0,
  recommendations_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE trend_comparisons (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  current_analysis_id TEXT NOT NULL REFERENCES historical_analyses(id) ON DELETE CASCADE,
  previous_analysis_id TEXT NOT NULL REFERENCES historical_analyses(id) ON DELETE CASCADE,
  comparison_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  significant_changes INTEGER NOT NULL DEFAULT 0,
  improvement_areas INTEGER NOT NULL DEFAULT 0,
  decline_areas INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs(next_run) WHERE is_active = TRUE;
CREATE INDEX idx_job_executions_job_id ON job_executions(job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_historical_analyses_job_id ON historical_analyses(job_id);
CREATE INDEX idx_historical_analyses_created_at ON historical_analyses(created_at);
CREATE INDEX idx_trend_comparisons_job_id ON trend_comparisons(job_id);
