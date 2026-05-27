-- 059: drop doc_comments. v8 W8 Comments feature was scoped out
-- (founder pulled it the same day it shipped, before any meaningful
-- writes). Migration 058_doc_comments.sql was deleted in the same
-- commit; this drop-only migration cleans the remote so the
-- schema matches the codebase.

DROP TABLE IF EXISTS doc_comments;
DROP TYPE IF EXISTS bundle_comment_visibility; -- defensive, never created
