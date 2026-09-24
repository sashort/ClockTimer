<?php
declare(strict_types=1);

const SPEECH_TRAINING_MIN_SAMPLES = 10;
const SPEECH_TRAINING_TARGET_ACCURACY = 0.85;

function ensure_speech_corrections_schema(PDO $pdo): void
{
    static $ready = false;

    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS speech_model_components ('
        . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, '
        . 'parent_component_id BIGINT UNSIGNED NULL, '
        . 'language_model_component_id BIGINT UNSIGNED NULL, '
        . 'component_key VARCHAR(500) NOT NULL, '
        . 'component_key_hash CHAR(64) NOT NULL, '
        . 'component_type ENUM("language-model","component") NOT NULL DEFAULT "component", '
        . 'language_code VARCHAR(32) NULL, '
        . 'name VARCHAR(191) NOT NULL, '
        . 'enabled TINYINT(1) NOT NULL DEFAULT 1, '
        . 'created_at BIGINT UNSIGNED NOT NULL, '
        . 'updated_at BIGINT UNSIGNED NOT NULL, '
        . 'PRIMARY KEY (id), '
        . 'UNIQUE KEY uq_speech_model_language (language_code), '
        . 'UNIQUE KEY uq_speech_model_component_key '
        . '(language_model_component_id, component_key_hash, component_key), '
        . 'KEY idx_speech_model_parent (parent_component_id), '
        . 'KEY idx_speech_model_root (language_model_component_id), '
        . 'CONSTRAINT fk_speech_model_parent '
        . 'FOREIGN KEY (parent_component_id) REFERENCES speech_model_components(id) '
        . 'ON UPDATE RESTRICT ON DELETE RESTRICT, '
        . 'CONSTRAINT fk_speech_model_root '
        . 'FOREIGN KEY (language_model_component_id) REFERENCES speech_model_components(id) '
        . 'ON UPDATE RESTRICT ON DELETE RESTRICT, '
        . 'CONSTRAINT chk_speech_model_enabled CHECK (enabled IN (0,1)), '
        . 'CONSTRAINT chk_speech_model_shape CHECK ('
        . '(component_type = "language-model" '
        . 'AND parent_component_id IS NULL '
        . 'AND language_model_component_id IS NULL '
        . 'AND language_code IS NOT NULL) '
        . 'OR '
        . '(component_type = "component" '
        . 'AND parent_component_id IS NOT NULL '
        . 'AND language_model_component_id IS NOT NULL '
        . 'AND language_code IS NULL)'
        . ')'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 '
        . 'COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS speech_model_phrases ('
        . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, '
        . 'component_id BIGINT UNSIGNED NOT NULL, '
        . 'phrase_key VARCHAR(500) NOT NULL, '
        . 'phrase_key_hash CHAR(64) NOT NULL, '
        . 'phrase VARCHAR(500) NOT NULL, '
        . 'created_at BIGINT UNSIGNED NOT NULL, '
        . 'updated_at BIGINT UNSIGNED NOT NULL, '
        . 'PRIMARY KEY (id), '
        . 'UNIQUE KEY uq_speech_model_phrase '
        . '(component_id, phrase_key_hash, phrase_key), '
        . 'KEY idx_speech_model_phrase_component (component_id), '
        . 'CONSTRAINT fk_speech_model_phrase_component '
        . 'FOREIGN KEY (component_id) REFERENCES speech_model_components(id) '
        . 'ON UPDATE RESTRICT ON DELETE RESTRICT'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 '
        . 'COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS speech_training_contributions ('
        . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, '
        . 'phrase_id BIGINT UNSIGNED NOT NULL, '
        . 'user_id BIGINT UNSIGNED NOT NULL, '
        . 'source ENUM("guided","manual","correction") NOT NULL, '
        . 'canonical VARCHAR(500) NOT NULL, '
        . 'canonical_compact VARCHAR(500) NOT NULL, '
        . 'observed VARCHAR(500) NOT NULL, '
        . 'observed_compact VARCHAR(500) NOT NULL, '
        . 'match_type ENUM("exact","prefix") NOT NULL DEFAULT "exact", '
        . 'recognized_correct TINYINT(1) NOT NULL, '
        . 'training_style VARCHAR(100) NULL, '
        . 'prompt_index SMALLINT UNSIGNED NULL, '
        . 'recognizer VARCHAR(64) NOT NULL DEFAULT "sherpa", '
        . 'pipeline VARCHAR(32) NULL, '
        . 'runtime_revision VARCHAR(100) NULL, '
        . 'metadata JSON NULL, '
        . 'active TINYINT(1) NOT NULL DEFAULT 1, '
        . 'revoked_at BIGINT UNSIGNED NULL, '
        . 'revoked_by_user_id BIGINT UNSIGNED NULL, '
        . 'revocation_reason VARCHAR(500) NULL, '
        . 'created_at BIGINT UNSIGNED NOT NULL, '
        . 'PRIMARY KEY (id), '
        . 'KEY idx_speech_training_phrase (phrase_id, active, created_at), '
        . 'KEY idx_speech_training_user (user_id, active, created_at), '
        . 'KEY idx_speech_training_variant '
        . '(phrase_id, active, observed_compact, canonical_compact, match_type), '
        . 'CONSTRAINT fk_speech_training_phrase '
        . 'FOREIGN KEY (phrase_id) REFERENCES speech_model_phrases(id) '
        . 'ON UPDATE RESTRICT ON DELETE RESTRICT, '
        . 'CONSTRAINT chk_speech_training_correct '
        . 'CHECK (recognized_correct IN (0,1)), '
        . 'CONSTRAINT chk_speech_training_active CHECK (active IN (0,1)), '
        . 'CONSTRAINT chk_speech_training_revocation CHECK ('
        . '(active = 1 AND revoked_at IS NULL AND revoked_by_user_id IS NULL) '
        . 'OR '
        . '(active = 0 AND revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL)'
        . ')'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 '
        . 'COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS speech_corrections ('
        . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, '
        . 'phrase_id BIGINT UNSIGNED NOT NULL, '
        . 'observed VARCHAR(500) NOT NULL, '
        . 'observed_compact VARCHAR(500) NOT NULL, '
        . 'canonical VARCHAR(500) NOT NULL, '
        . 'canonical_compact VARCHAR(500) NOT NULL, '
        . 'match_type ENUM("exact","prefix") NOT NULL DEFAULT "exact", '
        . 'enabled TINYINT(1) NOT NULL DEFAULT 1, '
        . 'occurrences INT UNSIGNED NOT NULL, '
        . 'contributor_count INT UNSIGNED NOT NULL, '
        . 'updated_at BIGINT UNSIGNED NOT NULL, '
        . 'PRIMARY KEY (id), '
        . 'UNIQUE KEY uq_speech_correction_phrase_mapping '
        . '(phrase_id, observed_compact, canonical_compact, match_type), '
        . 'KEY idx_speech_correction_runtime '
        . '(enabled, observed_compact, canonical_compact, match_type), '
        . 'CONSTRAINT fk_speech_correction_phrase '
        . 'FOREIGN KEY (phrase_id) REFERENCES speech_model_phrases(id) '
        . 'ON UPDATE RESTRICT ON DELETE CASCADE, '
        . 'CONSTRAINT chk_speech_correction_enabled CHECK (enabled IN (0,1)), '
        . 'CONSTRAINT chk_speech_correction_occurrences CHECK (occurrences > 0), '
        . 'CONSTRAINT chk_speech_correction_contributors CHECK (contributor_count > 0)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 '
        . 'COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS speech_training_audit ('
        . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, '
        . 'actor_user_id BIGINT UNSIGNED NOT NULL, '
        . 'subject_user_id BIGINT UNSIGNED NULL, '
        . 'language_model_component_id BIGINT UNSIGNED NULL, '
        . 'component_id BIGINT UNSIGNED NULL, '
        . 'phrase_id BIGINT UNSIGNED NULL, '
        . 'contribution_id BIGINT UNSIGNED NULL, '
        . 'action VARCHAR(64) NOT NULL, '
        . 'details JSON NULL, '
        . 'created_at BIGINT UNSIGNED NOT NULL, '
        . 'PRIMARY KEY (id), '
        . 'KEY idx_speech_training_audit_actor (actor_user_id, created_at), '
        . 'KEY idx_speech_training_audit_subject (subject_user_id, created_at), '
        . 'KEY idx_speech_training_audit_model (language_model_component_id, created_at), '
        . 'KEY idx_speech_training_audit_phrase (phrase_id, created_at), '
        . 'KEY idx_speech_training_audit_contribution (contribution_id, created_at)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 '
        . 'COLLATE=utf8mb4_unicode_ci'
    );

    $now = time();

    $seed =
        $pdo->prepare(
            'INSERT INTO speech_model_components '
            . '(parent_component_id, language_model_component_id, component_key, '
            . 'component_key_hash, component_type, language_code, name, enabled, '
            . 'created_at, updated_at) '
            . 'VALUES (NULL, NULL, :component_key, :component_key_hash, '
            . '"language-model", :language_code, :name, 1, :created_at, :updated_at) '
            . 'ON DUPLICATE KEY UPDATE updated_at = updated_at'
        );

    $seed->execute([
        ':component_key' => 'language:en-US',
        ':component_key_hash' => hash('sha256', 'language:en-US'),
        ':language_code' => 'en-US',
        ':name' => 'English (United States)',
        ':created_at' => $now,
        ':updated_at' => $now,
    ]);

    $ready = true;
}

function speech_training_state(int $samples, int $correct): string
{
    if ($samples <= 0) {
        return 'untrained';
    }

    $accuracy =
        $samples > 0
            ? $correct / $samples
            : 0.0;

    if (
        $samples >= SPEECH_TRAINING_MIN_SAMPLES &&
        $accuracy >= SPEECH_TRAINING_TARGET_ACCURACY
    ) {
        return 'well-trained';
    }

    return 'needs-samples';
}

function speech_training_stats_payload(
    string $phraseKey,
    string $phrase,
    int $samples,
    int $correct
): array {
    $accuracy =
        $samples > 0
            ? $correct / $samples
            : null;

    return [
        'phraseKey' => $phraseKey,
        'phrase' => $phrase,
        'samples' => $samples,
        'correct' => $correct,
        'incorrect' => max(0, $samples - $correct),
        'accuracy' => $accuracy,
        'minimumSamples' => SPEECH_TRAINING_MIN_SAMPLES,
        'targetAccuracy' => SPEECH_TRAINING_TARGET_ACCURACY,
        'state' => speech_training_state($samples, $correct),
    ];
}

function normalize_speech_correction_text(string $value): string
{
    $value = trim($value);

    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }

    $value = preg_replace(
        '/([^\p{L}\p{N}\s:.])+?/u',
        ' ',
        $value
    ) ?? $value;

    $value = preg_replace(
        '/\s+/u',
        ' ',
        $value
    ) ?? $value;

    return trim($value);
}

function compact_speech_correction_text(string $value): string
{
    return preg_replace(
        '/\s+/u',
        '',
        normalize_speech_correction_text($value)
    ) ?? '';
}

function speech_correction_language(mixed $value): string
{
    if ($value === null || $value === '') {
        return 'en-US';
    }

    if (
        !is_string($value) ||
        !preg_match('/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/D', $value)
    ) {
        api_error('language is invalid.', 422, 'invalid_argument');
    }

    return $value;
}

function speech_correction_match_type(mixed $value): string
{
    $type =
        is_string($value)
            ? strtolower(trim($value))
            : 'exact';

    if (!in_array($type, ['exact', 'prefix'], true)) {
        api_error('matchType must be exact or prefix.', 422, 'invalid_argument');
    }

    return $type;
}

function speech_correction_boolean(mixed $value, string $name): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if ($value === 1 || $value === 0 || $value === '1' || $value === '0') {
        return (bool) $value;
    }

    api_error($name . ' must be a boolean.', 422, 'invalid_argument');
}

function validate_speech_correction_pair(
    mixed $observedValue,
    mixed $canonicalValue
): array {
    if (!is_string($observedValue) || !is_string($canonicalValue)) {
        api_error('observed and canonical must be strings.', 422, 'invalid_argument');
    }

    $observed =
        normalize_speech_correction_text(
            $observedValue
        );

    $canonical =
        normalize_speech_correction_text(
            $canonicalValue
        );

    if ($observed === '' || $canonical === '') {
        api_error('observed and canonical must not be empty.', 422, 'invalid_argument');
    }

    if (strlen($observed) > 500 || strlen($canonical) > 500) {
        api_error('Speech corrections are limited to 500 characters.', 422, 'invalid_argument');
    }

    $observedCompact =
        compact_speech_correction_text(
            $observed
        );

    $canonicalCompact =
        compact_speech_correction_text(
            $canonical
        );

    if ($observedCompact === $canonicalCompact) {
        api_error(
            'The observed form must differ from the canonical phrase.',
            422,
            'redundant_correction'
        );
    }

    return [
        'observed' => $observed,
        'observedCompact' => $observedCompact,
        'canonical' => $canonical,
        'canonicalCompact' => $canonicalCompact,
    ];
}

function speech_training_component_key(mixed $value): string
{
    if ($value === null || $value === '') {
        return 'default';
    }

    if (!is_string($value)) {
        api_error('componentKey must be a string.', 422, 'invalid_argument');
    }

    $value = trim($value);

    if ($value === '' || strlen($value) > 500 || str_contains($value, "\0")) {
        api_error('componentKey is invalid.', 422, 'invalid_argument');
    }

    return $value;
}

function speech_training_phrase_key(mixed $value): string
{
    if (!is_string($value)) {
        api_error('phraseKey must be a string.', 422, 'invalid_argument');
    }

    $value = trim($value);

    if ($value === '' || strlen($value) > 500 || str_contains($value, "\0")) {
        api_error('phraseKey is invalid.', 422, 'invalid_argument');
    }

    return $value;
}

function speech_training_phrase(mixed $value): string
{
    if (!is_string($value)) {
        api_error('phrase must be a string.', 422, 'invalid_argument');
    }

    $value = trim($value);

    if ($value === '' || strlen($value) > 500 || str_contains($value, "\0")) {
        api_error('phrase is invalid.', 422, 'invalid_argument');
    }

    return $value;
}

function speech_model_root(
    PDO $pdo,
    string $language,
    bool $create = false
): ?array {
    $find =
        $pdo->prepare(
            'SELECT id, parent_component_id, language_model_component_id, '
            . 'component_key, component_type, language_code, name, enabled '
            . 'FROM speech_model_components '
            . 'WHERE component_type = "language-model" '
            . 'AND language_code = :language LIMIT 1'
        );

    $find->execute([
        ':language' => $language,
    ]);

    $row = $find->fetch();

    if ($row) {
        $row['id'] = (int) $row['id'];
        return $row;
    }

    if (!$create) {
        return null;
    }

    $now = time();
    $key = 'language:' . $language;

    $insert =
        $pdo->prepare(
            'INSERT INTO speech_model_components '
            . '(parent_component_id, language_model_component_id, component_key, '
            . 'component_key_hash, component_type, language_code, name, enabled, '
            . 'created_at, updated_at) '
            . 'VALUES (NULL, NULL, :component_key, :component_key_hash, '
            . '"language-model", :language, :name, 1, :created_at, :updated_at)'
        );

    try {
        $insert->execute([
            ':component_key' => $key,
            ':component_key_hash' => hash('sha256', $key),
            ':language' => $language,
            ':name' => $language,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    } catch (PDOException $error) {
        if ((string) $error->getCode() !== '23000') {
            throw $error;
        }
    }

    $find->execute([
        ':language' => $language,
    ]);

    $row = $find->fetch();

    if (!$row) {
        api_error('Unable to resolve speech language model.', 500, 'speech_model_error');
    }

    $row['id'] = (int) $row['id'];
    return $row;
}

function speech_model_component(
    PDO $pdo,
    array $languageModel,
    string $componentKey,
    bool $create = false
): ?array {
    if ($componentKey === 'language:' . $languageModel['language_code']) {
        return $languageModel;
    }

    $hash = hash('sha256', $componentKey);

    $find =
        $pdo->prepare(
            'SELECT id, parent_component_id, language_model_component_id, '
            . 'component_key, component_type, language_code, name, enabled '
            . 'FROM speech_model_components '
            . 'WHERE language_model_component_id = :model_id '
            . 'AND component_key_hash = :component_key_hash '
            . 'AND component_key = :component_key LIMIT 1'
        );

    $find->execute([
        ':model_id' => (int) $languageModel['id'],
        ':component_key_hash' => $hash,
        ':component_key' => $componentKey,
    ]);

    $row = $find->fetch();

    if ($row) {
        $row['id'] = (int) $row['id'];
        return $row;
    }

    if (!$create) {
        return null;
    }

    $now = time();

    $insert =
        $pdo->prepare(
            'INSERT INTO speech_model_components '
            . '(parent_component_id, language_model_component_id, component_key, '
            . 'component_key_hash, component_type, language_code, name, enabled, '
            . 'created_at, updated_at) '
            . 'VALUES (:parent_id, :model_id, :component_key, :component_key_hash, '
            . '"component", NULL, :name, 1, :created_at, :updated_at)'
        );

    try {
        $insert->execute([
            ':parent_id' => (int) $languageModel['id'],
            ':model_id' => (int) $languageModel['id'],
            ':component_key' => $componentKey,
            ':component_key_hash' => $hash,
            ':name' => substr($componentKey, 0, 191),
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    } catch (PDOException $error) {
        if ((string) $error->getCode() !== '23000') {
            throw $error;
        }
    }

    $find->execute([
        ':model_id' => (int) $languageModel['id'],
        ':component_key_hash' => $hash,
        ':component_key' => $componentKey,
    ]);

    $row = $find->fetch();

    if (!$row) {
        api_error('Unable to resolve speech model component.', 500, 'speech_model_error');
    }

    $row['id'] = (int) $row['id'];
    return $row;
}

function speech_model_phrase(
    PDO $pdo,
    int $componentId,
    string $phraseKey,
    string $phrase,
    bool $create = false
): ?array {
    $hash = hash('sha256', $phraseKey);

    $find =
        $pdo->prepare(
            'SELECT id, component_id, phrase_key, phrase '
            . 'FROM speech_model_phrases '
            . 'WHERE component_id = :component_id '
            . 'AND phrase_key_hash = :phrase_key_hash '
            . 'AND phrase_key = :phrase_key LIMIT 1'
        );

    $find->execute([
        ':component_id' => $componentId,
        ':phrase_key_hash' => $hash,
        ':phrase_key' => $phraseKey,
    ]);

    $row = $find->fetch();

    if ($row) {
        $row['id'] = (int) $row['id'];

        if ($create && (string) $row['phrase'] !== $phrase) {
            $update =
                $pdo->prepare(
                    'UPDATE speech_model_phrases '
                    . 'SET phrase = :phrase, updated_at = :updated_at '
                    . 'WHERE id = :id'
                );

            $update->execute([
                ':phrase' => $phrase,
                ':updated_at' => time(),
                ':id' => (int) $row['id'],
            ]);

            $row['phrase'] = $phrase;
        }

        return $row;
    }

    if (!$create) {
        return null;
    }

    $now = time();

    $insert =
        $pdo->prepare(
            'INSERT INTO speech_model_phrases '
            . '(component_id, phrase_key, phrase_key_hash, phrase, created_at, updated_at) '
            . 'VALUES (:component_id, :phrase_key, :phrase_key_hash, :phrase, '
            . ':created_at, :updated_at)'
        );

    try {
        $insert->execute([
            ':component_id' => $componentId,
            ':phrase_key' => $phraseKey,
            ':phrase_key_hash' => $hash,
            ':phrase' => $phrase,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    } catch (PDOException $error) {
        if ((string) $error->getCode() !== '23000') {
            throw $error;
        }
    }

    $find->execute([
        ':component_id' => $componentId,
        ':phrase_key_hash' => $hash,
        ':phrase_key' => $phraseKey,
    ]);

    $row = $find->fetch();

    if (!$row) {
        api_error('Unable to resolve speech phrase.', 500, 'speech_model_error');
    }

    $row['id'] = (int) $row['id'];
    return $row;
}

function rebuild_speech_corrections(
    PDO $pdo,
    int $languageModelComponentId,
    ?array $phraseIds = null
): int {
    if ($phraseIds === null) {
        $find =
            $pdo->prepare(
                'SELECT p.id '
                . 'FROM speech_model_phrases p '
                . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
                . 'WHERE COALESCE(c.language_model_component_id, c.id) = :model_id'
            );

        $find->execute([
            ':model_id' => $languageModelComponentId,
        ]);

        $phraseIds =
            array_map(
                'intval',
                $find->fetchAll(PDO::FETCH_COLUMN)
            );
    } else {
        $phraseIds =
            array_values(
                array_unique(
                    array_filter(
                        array_map('intval', $phraseIds),
                        static fn (int $id): bool => $id > 0
                    )
                )
            );
    }

    if ($phraseIds === []) {
        return 0;
    }

    $placeholders =
        implode(
            ',',
            array_fill(0, count($phraseIds), '?')
        );

    $delete =
        $pdo->prepare(
            'DELETE FROM speech_corrections '
            . 'WHERE phrase_id IN (' . $placeholders . ')'
        );

    $delete->execute($phraseIds);

    $insert =
        $pdo->prepare(
            'INSERT INTO speech_corrections '
            . '(phrase_id, observed, observed_compact, canonical, canonical_compact, '
            . 'match_type, enabled, occurrences, contributor_count, updated_at) '
            . 'SELECT phrase_id, MAX(observed), observed_compact, MAX(canonical), '
            . 'canonical_compact, match_type, 1, COUNT(*), COUNT(DISTINCT user_id), '
            . 'MAX(created_at) '
            . 'FROM speech_training_contributions '
            . 'WHERE active = 1 '
            . 'AND recognized_correct = 0 '
            . 'AND phrase_id IN (' . $placeholders . ') '
            . 'GROUP BY phrase_id, observed_compact, canonical_compact, match_type'
        );

    $insert->execute($phraseIds);

    return $insert->rowCount();
}

function speech_training_audit_event(
    PDO $pdo,
    int $actorUserId,
    string $action,
    ?int $languageModelComponentId = null,
    ?int $componentId = null,
    ?int $phraseId = null,
    ?int $subjectUserId = null,
    ?int $contributionId = null,
    array $details = []
): void {
    $insert =
        $pdo->prepare(
            'INSERT INTO speech_training_audit '
            . '(actor_user_id, subject_user_id, language_model_component_id, '
            . 'component_id, phrase_id, contribution_id, action, details, created_at) '
            . 'VALUES (:actor_user_id, :subject_user_id, :model_id, :component_id, '
            . ':phrase_id, :contribution_id, :action, :details, :created_at)'
        );

    $insert->execute([
        ':actor_user_id' => $actorUserId,
        ':subject_user_id' => $subjectUserId,
        ':model_id' => $languageModelComponentId,
        ':component_id' => $componentId,
        ':phrase_id' => $phraseId,
        ':contribution_id' => $contributionId,
        ':action' => $action,
        ':details' =>
            $details === []
                ? null
                : json_encode(
                    $details,
                    JSON_UNESCAPED_UNICODE |
                    JSON_UNESCAPED_SLASHES |
                    JSON_THROW_ON_ERROR
                ),
        ':created_at' => time(),
    ]);
}
