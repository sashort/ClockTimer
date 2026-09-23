<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/speech_corrections.php';

$method =
    require_method(
        'GET',
        'POST',
        'PUT',
        'DELETE'
    );

$pdo = db();

ensure_speech_corrections_schema(
    $pdo
);

if ($method === 'GET') {
    $manage =
        ($_GET['manage'] ?? null) ===
        '1';

    if ($manage) {
        require_any_permission(
            PERMISSION_DEVELOPER_PREVIEW,
            PERMISSION_DEVELOPER
        );
    }

    $language =
        speech_correction_language(
            $_GET['language'] ?? 'en-US'
        );

    $sql =
        'SELECT id, language, observed, observed_compact, canonical, '
        . 'canonical_compact, match_type, enabled, occurrences, '
        . 'created_by_user_id, created_at, updated_at '
        . 'FROM speech_corrections '
        . 'WHERE language = :language ';

    if (!$manage) {
        $sql .= 'AND enabled = 1 ';
    }

    $sql .=
        'ORDER BY occurrences DESC, updated_at DESC, id DESC';

    $statement =
        $pdo->prepare(
            $sql
        );

    $statement->execute([
        ':language' =>
            $language,
    ]);

    $corrections =
        array_map(
            'speech_correction_row',
            $statement->fetchAll()
        );

    $revision =
        hash(
            'sha256',
            json_encode(
                $corrections,
                JSON_UNESCAPED_UNICODE |
                JSON_UNESCAPED_SLASHES |
                JSON_THROW_ON_ERROR
            )
        );

    json_response([
        'language' => $language,
        'corrections' => $corrections,
        'revision' => $revision,
        'canWrite' =>
            $manage
                ? has_permission(
                    current_user(),
                    PERMISSION_DEVELOPER
                )
                : false,
        'csrfToken' =>
            $manage
                ? csrf_token()
                : null,
    ]);
}

$actor =
    require_permission(
        PERMISSION_DEVELOPER
    );

require_csrf();

$input =
    json_input();

if ($method === 'DELETE') {
    $id =
        require_positive_int(
            $input,
            'id'
        );

    $delete =
        $pdo->prepare(
            'DELETE FROM speech_corrections '
            . 'WHERE id = :id'
        );

    $delete->execute([
        ':id' => $id,
    ]);

    if ($delete->rowCount() !== 1) {
        api_error(
            'Speech correction was not found.',
            404,
            'not_found'
        );
    }

    json_response([
        'deleted' => true,
        'id' => $id,
    ]);
}

$language =
    speech_correction_language(
        $input['language'] ?? 'en-US'
    );

$pair =
    validate_speech_correction_pair(
        $input['observed'] ?? null,
        $input['canonical'] ?? null
    );

$matchType =
    speech_correction_match_type(
        $input['matchType'] ?? 'exact'
    );

$enabled =
    array_key_exists(
        'enabled',
        $input
    )
        ? speech_correction_boolean(
            $input['enabled'],
            'enabled'
        )
        : true;

$now = time();

if ($method === 'POST') {
    $statement =
        $pdo->prepare(
            'INSERT INTO speech_corrections '
            . '(language, observed, observed_compact, canonical, canonical_compact, '
            . 'match_type, enabled, occurrences, created_by_user_id, created_at, updated_at) '
            . 'VALUES (:language, :observed, :observed_compact, :canonical, '
            . ':canonical_compact, :match_type, :enabled, 1, :created_by_user_id, '
            . ':created_at, :updated_at) '
            . 'ON DUPLICATE KEY UPDATE '
            . 'observed = VALUES(observed), '
            . 'canonical = VALUES(canonical), '
            . 'enabled = 1, '
            . 'occurrences = occurrences + 1, '
            . 'updated_at = VALUES(updated_at)'
        );

    $statement->execute([
        ':language' =>
            $language,
        ':observed' =>
            $pair['observed'],
        ':observed_compact' =>
            $pair['observedCompact'],
        ':canonical' =>
            $pair['canonical'],
        ':canonical_compact' =>
            $pair['canonicalCompact'],
        ':match_type' =>
            $matchType,
        ':enabled' =>
            $enabled ? 1 : 0,
        ':created_by_user_id' =>
            (int) $actor['id'],
        ':created_at' =>
            $now,
        ':updated_at' =>
            $now,
    ]);

    $lookup =
        $pdo->prepare(
            'SELECT id, language, observed, observed_compact, canonical, '
            . 'canonical_compact, match_type, enabled, occurrences, '
            . 'created_by_user_id, created_at, updated_at '
            . 'FROM speech_corrections '
            . 'WHERE language = :language '
            . 'AND observed_compact = :observed_compact '
            . 'AND canonical_compact = :canonical_compact '
            . 'AND match_type = :match_type LIMIT 1'
        );

    $lookup->execute([
        ':language' =>
            $language,
        ':observed_compact' =>
            $pair['observedCompact'],
        ':canonical_compact' =>
            $pair['canonicalCompact'],
        ':match_type' =>
            $matchType,
    ]);

    json_response([
        'trained' => true,
        'correction' =>
            speech_correction_row(
                $lookup->fetch()
            ),
    ], 201);
}

$id =
    require_positive_int(
        $input,
        'id'
    );

$statement =
    $pdo->prepare(
        'UPDATE speech_corrections SET '
        . 'language = :language, '
        . 'observed = :observed, '
        . 'observed_compact = :observed_compact, '
        . 'canonical = :canonical, '
        . 'canonical_compact = :canonical_compact, '
        . 'match_type = :match_type, '
        . 'enabled = :enabled, '
        . 'updated_at = :updated_at '
        . 'WHERE id = :id'
    );

try {
    $statement->execute([
        ':language' =>
            $language,
        ':observed' =>
            $pair['observed'],
        ':observed_compact' =>
            $pair['observedCompact'],
        ':canonical' =>
            $pair['canonical'],
        ':canonical_compact' =>
            $pair['canonicalCompact'],
        ':match_type' =>
            $matchType,
        ':enabled' =>
            $enabled ? 1 : 0,
        ':updated_at' =>
            $now,
        ':id' =>
            $id,
    ]);
}
catch (PDOException $error) {
    if ((string) $error->getCode() === '23000') {
        api_error(
            'An equivalent speech correction already exists.',
            409,
            'duplicate_correction'
        );
    }

    throw $error;
}

if ($statement->rowCount() === 0) {
    $exists =
        $pdo->prepare(
            'SELECT id FROM speech_corrections '
            . 'WHERE id = :id LIMIT 1'
        );

    $exists->execute([
        ':id' => $id,
    ]);

    if (!$exists->fetchColumn()) {
        api_error(
            'Speech correction was not found.',
            404,
            'not_found'
        );
    }
}

json_response([
    'updated' => true,
    'id' => $id,
]);
