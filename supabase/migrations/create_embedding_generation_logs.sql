-- Embedding生成ログテーブルを作成
CREATE TABLE IF NOT EXISTS embedding_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_type VARCHAR(50) NOT NULL, -- 'scheduled' or 'manual'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  failed_article_ids TEXT[], -- 失敗した記事のID配列
  error_summary TEXT, -- エラーの概要
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスを追加（検索を高速化）
CREATE INDEX IF NOT EXISTS idx_embedding_logs_started_at ON embedding_generation_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_embedding_logs_execution_type ON embedding_generation_logs(execution_type);

-- コメントを追加
COMMENT ON TABLE embedding_generation_logs IS 'Embedding生成ジョブの実行ログを記録するテーブル';
COMMENT ON COLUMN embedding_generation_logs.execution_type IS '実行タイプ: scheduled (自動実行) または manual (手動実行)';
COMMENT ON COLUMN embedding_generation_logs.failed_article_ids IS '失敗した記事のID配列';

