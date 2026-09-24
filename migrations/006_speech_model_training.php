<?php
declare(strict_types=1);

return [
    "DROP TABLE IF EXISTS speech_corrections",
    "DROP TABLE IF EXISTS speech_training_samples",

    "CREATE TABLE speech_model_components (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        parent_component_id BIGINT UNSIGNED NULL,
        language_model_component_id BIGINT UNSIGNED NULL,
        component_key VARCHAR(500) NOT NULL,
        component_key_hash CHAR(64) NOT NULL,
        component_type ENUM('language-model','component') NOT NULL DEFAULT 'component',
        language_code VARCHAR(32) NULL,
        name VARCHAR(191) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at BIGINT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_speech_model_language (language_code),
        UNIQUE KEY uq_speech_model_component_key
            (language_model_component_id, component_key_hash, component_key),
        KEY idx_speech_model_parent (parent_component_id),
        KEY idx_speech_model_root (language_model_component_id),
        CONSTRAINT fk_speech_model_parent
            FOREIGN KEY (parent_component_id) REFERENCES speech_model_components(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_speech_model_root
            FOREIGN KEY (language_model_component_id) REFERENCES speech_model_components(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT chk_speech_model_enabled CHECK (enabled IN (0,1)),
        CONSTRAINT chk_speech_model_shape CHECK (
            (
                component_type = 'language-model'
                AND parent_component_id IS NULL
                AND language_model_component_id IS NULL
                AND language_code IS NOT NULL
            )
            OR
            (
                component_type = 'component'
                AND parent_component_id IS NOT NULL
                AND language_model_component_id IS NOT NULL
                AND language_code IS NULL
            )
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "INSERT INTO speech_model_components
        (parent_component_id, language_model_component_id, component_key,
         component_key_hash, component_type, language_code, name,
         enabled, created_at, updated_at)
     VALUES
        (NULL, NULL, 'language:en-US', SHA2('language:en-US', 256),
         'language-model', 'en-US', 'English (United States)',
         1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())",

    "CREATE TABLE speech_model_phrases (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        component_id BIGINT UNSIGNED NOT NULL,
        phrase_key VARCHAR(500) NOT NULL,
        phrase_key_hash CHAR(64) NOT NULL,
        phrase VARCHAR(500) NOT NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_speech_model_phrase
            (component_id, phrase_key_hash, phrase_key),
        KEY idx_speech_model_phrase_component (component_id),
        CONSTRAINT fk_speech_model_phrase_component
            FOREIGN KEY (component_id) REFERENCES speech_model_components(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE speech_training_contributions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        phrase_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        source ENUM('guided','manual','correction') NOT NULL,
        canonical VARCHAR(500) NOT NULL,
        canonical_compact VARCHAR(500) NOT NULL,
        observed VARCHAR(500) NOT NULL,
        observed_compact VARCHAR(500) NOT NULL,
        match_type ENUM('exact','prefix') NOT NULL DEFAULT 'exact',
        recognized_correct TINYINT(1) NOT NULL,
        training_style VARCHAR(100) NULL,
        prompt_index SMALLINT UNSIGNED NULL,
        recognizer VARCHAR(64) NOT NULL DEFAULT 'sherpa',
        pipeline VARCHAR(32) NULL,
        runtime_revision VARCHAR(100) NULL,
        metadata JSON NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        revoked_at BIGINT UNSIGNED NULL,
        revoked_by_user_id BIGINT UNSIGNED NULL,
        revocation_reason VARCHAR(500) NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_speech_training_phrase (phrase_id, active, created_at),
        KEY idx_speech_training_user (user_id, active, created_at),
        KEY idx_speech_training_variant
            (phrase_id, active, observed_compact, canonical_compact, match_type),
        CONSTRAINT fk_speech_training_phrase
            FOREIGN KEY (phrase_id) REFERENCES speech_model_phrases(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT chk_speech_training_correct
            CHECK (recognized_correct IN (0,1)),
        CONSTRAINT chk_speech_training_active
            CHECK (active IN (0,1)),
        CONSTRAINT chk_speech_training_revocation
            CHECK (
                (active = 1 AND revoked_at IS NULL AND revoked_by_user_id IS NULL)
                OR
                (active = 0 AND revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL)
            )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE speech_corrections (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        phrase_id BIGINT UNSIGNED NOT NULL,
        observed VARCHAR(500) NOT NULL,
        observed_compact VARCHAR(500) NOT NULL,
        canonical VARCHAR(500) NOT NULL,
        canonical_compact VARCHAR(500) NOT NULL,
        match_type ENUM('exact','prefix') NOT NULL DEFAULT 'exact',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        occurrences INT UNSIGNED NOT NULL,
        contributor_count INT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_speech_correction_phrase_mapping
            (phrase_id, observed_compact, canonical_compact, match_type),
        KEY idx_speech_correction_runtime
            (enabled, observed_compact, canonical_compact, match_type),
        CONSTRAINT fk_speech_correction_phrase
            FOREIGN KEY (phrase_id) REFERENCES speech_model_phrases(id)
            ON UPDATE RESTRICT ON DELETE CASCADE,
        CONSTRAINT chk_speech_correction_enabled CHECK (enabled IN (0,1)),
        CONSTRAINT chk_speech_correction_occurrences CHECK (occurrences > 0),
        CONSTRAINT chk_speech_correction_contributors CHECK (contributor_count > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE speech_training_audit (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        actor_user_id BIGINT UNSIGNED NOT NULL,
        subject_user_id BIGINT UNSIGNED NULL,
        language_model_component_id BIGINT UNSIGNED NULL,
        component_id BIGINT UNSIGNED NULL,
        phrase_id BIGINT UNSIGNED NULL,
        contribution_id BIGINT UNSIGNED NULL,
        action VARCHAR(64) NOT NULL,
        details JSON NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_speech_training_audit_actor (actor_user_id, created_at),
        KEY idx_speech_training_audit_subject (subject_user_id, created_at),
        KEY idx_speech_training_audit_model (language_model_component_id, created_at),
        KEY idx_speech_training_audit_phrase (phrase_id, created_at),
        KEY idx_speech_training_audit_contribution (contribution_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TRIGGER protect_speech_training_audit_update
     BEFORE UPDATE ON speech_training_audit
     FOR EACH ROW
     BEGIN
         SIGNAL SQLSTATE '45000'
             SET MESSAGE_TEXT = 'Speech training audit entries are immutable';
     END",

    "CREATE TRIGGER protect_speech_training_audit_delete
     BEFORE DELETE ON speech_training_audit
     FOR EACH ROW
     BEGIN
         SIGNAL SQLSTATE '45000'
             SET MESSAGE_TEXT = 'Speech training audit entries are immutable';
     END",

    "CREATE TRIGGER audit_speech_training_contribution_add
     AFTER INSERT ON speech_training_contributions
     FOR EACH ROW
     BEGIN
         INSERT INTO speech_training_audit
             (actor_user_id, subject_user_id, language_model_component_id,
              component_id, phrase_id, contribution_id, action, details, created_at)
         SELECT
             NEW.user_id,
             NEW.user_id,
             COALESCE(c.language_model_component_id, c.id),
             c.id,
             p.id,
             NEW.id,
             'contribution-added',
             JSON_OBJECT(
                 'source', NEW.source,
                 'canonical', NEW.canonical,
                 'observed', NEW.observed,
                 'matchType', NEW.match_type,
                 'recognizedCorrect', NEW.recognized_correct,
                 'trainingStyle', NEW.training_style,
                 'promptIndex', NEW.prompt_index,
                 'recognizer', NEW.recognizer,
                 'pipeline', NEW.pipeline,
                 'runtimeRevision', NEW.runtime_revision,
                 'metadata', NEW.metadata
             ),
             NEW.created_at
         FROM speech_model_phrases p
         INNER JOIN speech_model_components c ON c.id = p.component_id
         WHERE p.id = NEW.phrase_id;
     END",

    "CREATE TRIGGER audit_speech_training_contribution_edit
     AFTER UPDATE ON speech_training_contributions
     FOR EACH ROW
     BEGIN
         IF OLD.active <> NEW.active
            OR NOT (OLD.revoked_at <=> NEW.revoked_at)
            OR NOT (OLD.revoked_by_user_id <=> NEW.revoked_by_user_id)
            OR NOT (OLD.revocation_reason <=> NEW.revocation_reason) THEN
             INSERT INTO speech_training_audit
                 (actor_user_id, subject_user_id, language_model_component_id,
                  component_id, phrase_id, contribution_id, action, details, created_at)
             SELECT
                 COALESCE(NEW.revoked_by_user_id, NEW.user_id),
                 NEW.user_id,
                 COALESCE(c.language_model_component_id, c.id),
                 c.id,
                 p.id,
                 NEW.id,
                 CASE WHEN NEW.active = 0
                      THEN 'contribution-revoked'
                      ELSE 'contribution-restored'
                 END,
                 JSON_OBJECT(
                     'activeBefore', OLD.active,
                     'activeAfter', NEW.active,
                     'revokedAt', NEW.revoked_at,
                     'revocationReason', NEW.revocation_reason
                 ),
                 UNIX_TIMESTAMP()
             FROM speech_model_phrases p
             INNER JOIN speech_model_components c ON c.id = p.component_id
             WHERE p.id = NEW.phrase_id;
         END IF;
     END",

    "CREATE TRIGGER audit_speech_training_contribution_delete
     AFTER DELETE ON speech_training_contributions
     FOR EACH ROW
     BEGIN
         INSERT INTO speech_training_audit
             (actor_user_id, subject_user_id, language_model_component_id,
              component_id, phrase_id, contribution_id, action, details, created_at)
         SELECT
             COALESCE(@speech_training_actor_user_id, OLD.user_id),
             OLD.user_id,
             COALESCE(c.language_model_component_id, c.id),
             c.id,
             p.id,
             OLD.id,
             'contribution-deleted',
             JSON_OBJECT(
                 'source', OLD.source,
                 'canonical', OLD.canonical,
                 'observed', OLD.observed,
                 'matchType', OLD.match_type,
                 'recognizedCorrect', OLD.recognized_correct,
                 'active', OLD.active,
                 'createdAt', OLD.created_at
             ),
             UNIX_TIMESTAMP()
         FROM speech_model_phrases p
         INNER JOIN speech_model_components c ON c.id = p.component_id
         WHERE p.id = OLD.phrase_id;
     END"
];
