/*
# Create knowledge library tables

Plain-English summary: adds the storage needed for the KnowledgeX AI library. Uploaded documents are stored with their extracted text, split into searchable chunks, and every question, summary or comparison is recorded in a search history.

1. New Tables
- `documents`: one row per uploaded file (title, original file name, file type, size, demo flag, created time).
- `document_chunks`: the text of each document split into ordered pieces used for retrieval and citations. Deleting a document deletes its chunks.
- `search_history`: each question, summary or comparison run by the user, with its kind and a JSON result snapshot.

2. Security
- Row level security is enabled on all three tables.
- The app has no sign-in screen, so the library is shared and the anon role is granted access. The policies below intentionally use `USING (true)` for this shared, single-workspace data.

3. Important notes
- No existing tables are modified.
- All statements are idempotent so the migration can be safely re-run.
*/

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
  byte_size integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_hint integer,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ask', 'summary', 'compare')),
  query text NOT NULL,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ta')),
  document_ids uuid[] NOT NULL DEFAULT '{}',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_history TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_document_chunks" ON document_chunks;
CREATE POLICY "anon_select_document_chunks" ON document_chunks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_document_chunks" ON document_chunks;
CREATE POLICY "anon_insert_document_chunks" ON document_chunks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_document_chunks" ON document_chunks;
CREATE POLICY "anon_update_document_chunks" ON document_chunks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_document_chunks" ON document_chunks;
CREATE POLICY "anon_delete_document_chunks" ON document_chunks FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_search_history" ON search_history;
CREATE POLICY "anon_select_search_history" ON search_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_search_history" ON search_history;
CREATE POLICY "anon_insert_search_history" ON search_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_search_history" ON search_history;
CREATE POLICY "anon_update_search_history" ON search_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_search_history" ON search_history;
CREATE POLICY "anon_delete_search_history" ON search_history FOR DELETE TO anon, authenticated USING (true);
