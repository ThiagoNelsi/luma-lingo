-- Evidence is no longer append-only: administrative corrections and deletions
-- are allowed, including deletes cascading from a user removal.
DROP TRIGGER "concept_evidence_append_only" ON "concept_evidence";

DROP FUNCTION "reject_concept_evidence_mutation"();
