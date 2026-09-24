import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
    new URL(
        "../migrations/006_speech_model_training.php",
        import.meta.url
    ),
    "utf8"
);

const core = fs.readFileSync(
    new URL(
        "../api/_core/speech_corrections.php",
        import.meta.url
    ),
    "utf8"
);

const api = fs.readFileSync(
    new URL(
        "../api/speech-corrections/index.php",
        import.meta.url
    ),
    "utf8"
);

const editor = fs.readFileSync(
    new URL(
        "../api/admin/speech-editor/editor.js",
        import.meta.url
    ),
    "utf8"
);

const editorPage = fs.readFileSync(
    new URL(
        "../api/admin/speech-editor/index.php",
        import.meta.url
    ),
    "utf8"
);

const baseSchema = fs.readFileSync(
    new URL(
        "../database/create_database.sql",
        import.meta.url
    ),
    "utf8"
);

assert.match(
    migration,
    /CREATE TABLE speech_model_components/
);
assert.match(
    migration,
    /parent_component_id BIGINT UNSIGNED NULL/
);
assert.match(
    migration,
    /component_type ENUM\('language-model','component'\)/
);
assert.match(
    migration,
    /language_code VARCHAR\(32\) NULL/
);
assert.match(
    migration,
    /language_model_component_id BIGINT UNSIGNED NULL/
);
assert.match(
    migration,
    /'language-model', 'en-US'/
);

assert.match(
    migration,
    /CREATE TABLE speech_model_phrases/
);
assert.match(
    migration,
    /CREATE TABLE speech_training_contributions/
);
assert.match(
    migration,
    /user_id BIGINT UNSIGNED NOT NULL/
);
assert.match(
    migration,
    /source ENUM\('guided','manual','correction'\)/
);
assert.match(
    migration,
    /mapping_hash CHAR\(64\) NOT NULL/
);
assert.match(
    migration,
    /recognized_correct TINYINT\(1\) NOT NULL/
);
assert.match(
    migration,
    /training_style VARCHAR\(100\) NULL/
);
assert.match(
    migration,
    /prompt_index SMALLINT UNSIGNED NULL/
);
assert.match(
    migration,
    /runtime_revision VARCHAR\(100\) NULL/
);
assert.match(
    migration,
    /revoked_by_user_id BIGINT UNSIGNED NULL/
);

assert.match(
    migration,
    /CREATE TABLE speech_training_audit/
);
assert.match(
    migration,
    /actor_username VARCHAR\(191\) NULL/
);
assert.match(
    migration,
    /subject_username VARCHAR\(191\) NULL/
);
assert.match(
    migration,
    /component_key VARCHAR\(500\) NULL/
);
assert.match(
    migration,
    /phrase_key VARCHAR\(500\) NULL/
);
assert.match(
    migration,
    /protect_speech_training_audit_update/
);
assert.match(
    migration,
    /protect_speech_training_audit_delete/
);
assert.match(
    migration,
    /audit_speech_training_contribution_add/
);
assert.match(
    migration,
    /audit_speech_training_contribution_edit/
);
assert.match(
    migration,
    /audit_speech_training_contribution_delete/
);

assert.doesNotMatch(
    core,
    /CREATE TABLE IF NOT EXISTS speech_training_samples/
);
assert.match(
    core,
    /function speech_model_root/
);
assert.match(
    core,
    /function speech_model_component/
);
assert.match(
    core,
    /function speech_model_phrase/
);
assert.match(
    core,
    /function rebuild_speech_corrections/
);
assert.match(
    core,
    /recognized_correct = 0/
);
assert.match(
    core,
    /COUNT\(DISTINCT user_id\)/
);
assert.match(
    core,
    /SHA2\(CONCAT\(observed_compact/
);

assert.match(
    api,
    /\$sampleUser\s*=\s*current_user\(\)|\$user\s*=\s*[\s\S]*current_user\(\)/
);
assert.match(
    api,
    /require_csrf\(\)/
);
assert.match(
    api,
    /PERMISSION_DEVELOPER/
);
assert.match(
    api,
    /action ===\s*'reset'/
);
assert.match(
    api,
    /\['contribution', 'contributions'\]/
);
assert.match(
    api,
    /revoked_by_user_id/
);
assert.match(
    api,
    /contributors/
);

assert.match(
    editorPage,
    /data-can-train/
);
assert.match(
    editor,
    /componentKey:/
);
assert.match(
    editor,
    /runtimeRevision:/
);
assert.match(
    editor,
    /speechTrainingModelContributors/
);
assert.match(
    editor,
    /Remove from phrase/
);
assert.match(
    editor,
    /Remove all/
);
assert.match(
    editor,
    /action:\s*"reset"/
);

assert.match(
    baseSchema,
    /CREATE TABLE IF NOT EXISTS `speech_model_components`/
);
assert.match(
    baseSchema,
    /CREATE TABLE IF NOT EXISTS `speech_training_audit`/
);
assert.doesNotMatch(
    baseSchema,
    /CREATE TABLE IF NOT EXISTS `speech_training_samples`/
);

console.log(
    "speech training model invariants passed"
);
