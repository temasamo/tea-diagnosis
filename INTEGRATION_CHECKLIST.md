# Supabase統合作業 チェックリスト

## ✅ 確認済み項目

1. **接続情報**
   - ✅ 新しいプロジェクトのURL: 設定済み
   - ✅ API Keys: 設定済み（Anon Key & Service Role Key）

2. **テーブル構造**
   - ✅ `tea_articles`テーブル: 存在確認済み
   - ✅ データ件数: 15件
   - ✅ `embedding`カラム: 存在確認済み

3. **RPC関数**
   - ✅ `match_tea_articles`関数: 存在確認済み

4. **環境変数**
   - ✅ すべての必要な環境変数が設定済み

## ⚠️ 要確認項目

### 1. embeddingカラムの型確認

**問題**: 現在、embeddingが`string`型として認識されている可能性があります。

**確認方法**:
1. Supabase Dashboard → SQL Editor を開く
2. 以下のSQLを実行:

```sql
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'tea_articles' 
  AND column_name = 'embedding';
```

**期待される結果**:
- `data_type`: `USER-DEFINED` または `vector`
- `udt_name`: `vector`

**もし`text`型だった場合**:
以下のSQLを実行して修正:

```sql
-- 1. 既存のembeddingカラムを削除（データは失われる）
ALTER TABLE tea_articles DROP COLUMN IF EXISTS embedding;

-- 2. vector型でembeddingカラムを再作成
ALTER TABLE tea_articles ADD COLUMN embedding vector(1536);

-- 3. embeddingを再生成（以下のコマンドを実行）
-- npx tsx src/scripts/generateTeaEmbeddings.ts
```

### 2. RPC関数の動作確認

**確認方法**:
1. Supabase Dashboard → SQL Editor を開く
2. 以下のSQLを実行（実際のembeddingデータでテスト）:

```sql
-- テスト用のembeddingを取得
SELECT id, title, embedding 
FROM tea_articles 
WHERE embedding IS NOT NULL 
LIMIT 1;

-- 取得したembeddingでRPC関数をテスト
SELECT * FROM match_tea_articles(
  (SELECT embedding FROM tea_articles WHERE embedding IS NOT NULL LIMIT 1),
  0.5,
  3
);
```

**期待される結果**: 類似記事が1-3件返ってくる

### 3. embeddingデータの再生成

**もしembeddingカラムの型を修正した場合**:
以下のコマンドでembeddingを再生成:

```bash
npx tsx src/scripts/generateTeaEmbeddings.ts
```

### 4. 実際の動作確認

**確認方法**:
1. アプリケーションでクイック診断を実行
2. ブラウザのコンソールで以下のログを確認:
   - `✅ RAG検索成功: 記事数: X`
   - `hasArticles: true`
   - `rpcUsed: true`
   - `searchError: null`

## 📋 統合作業で必要な情報

以下の情報を提供していただければ、より正確な診断ができます:

1. **Supabase SQL Editorでの確認結果**
   - embeddingカラムの型（上記SQLの結果）
   - RPC関数のテスト結果

2. **エラーメッセージ**（もしあれば）
   - ブラウザコンソールのエラー
   - Vercelのログのエラー

3. **以前のプロジェクトとの違い**
   - テーブル構造の変更点
   - データ移行方法
   - RPC関数の変更点（もしあれば）

## 🛠️ 確認用スクリプト

以下のコマンドで統合状況を確認できます:

```bash
npx tsx src/scripts/checkSupabaseIntegration.ts
```

## 📝 次のステップ

1. ✅ 確認スクリプトを実行 → **完了**
2. ⚠️ SQL Editorでembeddingカラムの型を確認
3. ⚠️ 必要に応じてカラム型を修正
4. ⚠️ embeddingを再生成
5. ⚠️ 実際の動作確認



