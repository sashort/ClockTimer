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

$language =
    speech_correction_language(
        $_GET['language'] ??
        'en-US'
    );

$correctionRows =
    static function (
        bool $manage
    ) use (
        $pdo,
        $language
    ): array {
        $sql =
            'SELECT id, language, observed, observed_compact, canonical, '
            . 'canonical_compact, match_type, enabled, occurrences, '
            . 'created_by_user_id, created_at, updated_at '
            . 'FROM speech_corrections '
            . 'WHERE language = :language ';

        if (!$manage) {
            $sql .=
                'AND enabled = 1 ';
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

        return array_map(
            'speech_correction_row',
            $statement->fetchAll()
        );
    };

$trainingStats =
    static function () use (
        $pdo,
        $language
    ): array {
        $statement =
            $pdo->prepare(
                'SELECT phrase_key, phrase, '
                . 'COUNT(*) AS sample_count, '
                . 'SUM(recognized_correct) AS correct_count '
                . 'FROM speech_training_samples '
                . 'WHERE language = :language '
                . 'GROUP BY phrase_key_hash, phrase_key, phrase '
                . 'ORDER BY phrase_key'
            );

        $statement->execute([
            ':language' =>
                $language,
        ]);

        $stats = [];

        foreach (
            $statement->fetchAll()
            as $row
        ) {
            $payload =
                speech_training_stats_payload(
                    (string) $row['phrase_key'],
                    (string) $row['phrase'],
                    (int) $row['sample_count'],
                    (int) $row['correct_count']
                );

            $stats[
                $payload['phraseKey']
            ] =
                $payload;
        }

        return $stats;
    };

$phraseTraining =
    static function (
        string $phraseKey
    ) use (
        $pdo,
        $language
    ): array {
        $hash =
            hash(
                'sha256',
                $phraseKey
            );

        $statement =
            $pdo->prepare(
                'SELECT id, phrase, canonical, canonical_compact, '
                . 'observed, observed_compact, recognized_correct, '
                . 'created_by_user_id, created_at '
                . 'FROM speech_training_samples '
                . 'WHERE language = :language '
                . 'AND phrase_key_hash = :phrase_key_hash '
                . 'AND phrase_key = :phrase_key '
                . 'ORDER BY id DESC '
                . 'LIMIT 100'
            );

        $statement->execute([
            ':language' =>
                $language,
            ':phrase_key_hash' =>
                $hash,
            ':phrase_key' =>
                $phraseKey,
        ]);

        $samples = [];
        $variants = [];

        foreach (
            $statement->fetchAll()
            as $row
        ) {
            $sample = [
                'id' =>
                    (int) $row['id'],
                'phrase' =>
                    (string) $row['phrase'],
                'canonical' =>
                    (string) $row['canonical'],
                'canonicalCompact' =>
                    (string) $row['canonical_compact'],
                'observed' =>
                    (string) $row['observed'],
                'observedCompact' =>
                    (string) $row['observed_compact'],
                'correct' =>
                    (bool) $row['recognized_correct'],
                'createdByUserId' =>
                    $row['created_by_user_id'] ===
                        null
                        ? null
                        : (int) $row['created_by_user_id'],
                'createdAt' =>
                    (int) $row['created_at'],
            ];

            $samples[] =
                $sample;

            $variantKey =
                $sample[
                    'observedCompact'
                ];

            if (
                !isset(
                    $variants[
                        $variantKey
                    ]
                )
            ) {
                $variants[
                    $variantKey
                ] = [
                    'observed' =>
                        $sample['observed'],
                    'observedCompact' =>
                        $variantKey,
                    'count' => 0,
                    'correct' => 0,
                    'incorrect' => 0,
                    'lastSeenAt' =>
                        $sample['createdAt'],
                ];
            }

            $variants[
                $variantKey
            ]['count']++;

            if ($sample['correct']) {
                $variants[
                    $variantKey
                ]['correct']++;
            } else {
                $variants[
                    $variantKey
                ]['incorrect']++;
            }

            $variants[
                $variantKey
            ]['lastSeenAt'] =
                max(
                    $variants[
                        $variantKey
                    ]['lastSeenAt'],
                    $sample['createdAt']
                );
        }

        usort(
            $variants,
            static fn (
                array $left,
                array $right
            ): int =>
                $right['count'] <=>
                    $left['count'] ||
                $right['lastSeenAt'] <=>
                    $left['lastSeenAt']
        );

        return [
            'samples' =>
                $samples,
            'variants' =>
                array_values(
                    $variants
                ),
        ];
    };

if ($method === 'GET') {
    $manage =
        ($_GET['manage'] ?? null) ===
        '1';

    $authorization =
        $manage
            ? authorize_guarded_access(
                [
                    PERMISSION_DEVELOPER_PREVIEW,
                    PERMISSION_DEVELOPER
                ],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            )
            : null;

    $corrections =
        $correctionRows(
            $manage
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

    $payload = [
        'language' =>
            $language,
        'corrections' =>
            $corrections,
        'revision' =>
            $revision,
    ];

    if ($manage) {
        $payload['trainingStats'] =
            $trainingStats();

        $payload['minimumSamples'] =
            SPEECH_TRAINING_MIN_SAMPLES;

        $payload['targetAccuracy'] =
            SPEECH_TRAINING_TARGET_ACCURACY;

        $payload['canWrite'] =
            guarded_access_has_permission(
                $authorization,
                PERMISSION_DEVELOPER
            );

        $payload['csrfToken'] =
            csrf_token();

        if (
            isset(
                $_GET[
                    'phraseKey'
                ]
            )
        ) {
            $phraseKey =
                speech_training_phrase_key(
                    $_GET[
                        'phraseKey'
                    ]
                );

            $payload['training'] =
                $phraseTraining(
                    $phraseKey
                );
        }
    }

    json_response(
        $payload
    );
}

$authorization =
    authorize_guarded_access(
        [PERMISSION_DEVELOPER],
        ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
    );

if (
    guarded_access_requires_csrf(
        $authorization
    )
) {
    require_csrf();
}

$actorId =
    guarded_access_audit_user_id(
        $authorization
    );

$input =
    json_input();

$inputLanguage =
    speech_correction_language(
        $input['language'] ??
        'en-US'
    );

if (
    $inputLanguage !==
    $language
) {
    $language =
        $inputLanguage;
}

if (
    $method === 'POST' &&
    (
        $input['action'] ??
        'correction'
    ) ===
        'sample'
) {
    $phraseKey =
        speech_training_phrase_key(
            $input['phraseKey'] ??
            null
        );

    $phrase =
        speech_training_phrase(
            $input['phrase'] ??
            null
        );

    $canonicalRaw =
        $input['canonical'] ??
        null;

    $observedRaw =
        $input['observed'] ??
        null;

    if (
        !is_string(
            $canonicalRaw
        ) ||
        !is_string(
            $observedRaw
        )
    ) {
        api_error(
            'canonical and observed must be strings.',
            422,
            'invalid_argument'
        );
    }

    $canonical =
        normalize_speech_correction_text(
            $canonicalRaw
        );

    $observed =
        normalize_speech_correction_text(
            $observedRaw
        );

    if (
        $canonical === '' ||
        $observed === ''
    ) {
        api_error(
            'canonical and observed must not be empty.',
            422,
            'invalid_argument'
        );
    }

    if (
        strlen(
            $canonical
        ) > 500 ||
        strlen(
            $observed
        ) > 500
    ) {
        api_error(
            'Training samples are limited to 500 characters.',
            422,
            'invalid_argument'
        );
    }

    $canonicalCompact =
        compact_speech_correction_text(
            $canonical
        );

    $observedCompact =
        compact_speech_correction_text(
            $observed
        );

    $recognizedCorrect =
        $canonicalCompact ===
        $observedCompact;

    $now =
        time();

    $statement =
        $pdo->prepare(
            'INSERT INTO speech_training_samples '
            . '(language, phrase_key, phrase_key_hash, phrase, '
            . 'canonical, canonical_compact, observed, observed_compact, '
            . 'recognized_correct, created_by_user_id, created_at) '
            . 'VALUES (:language, :phrase_key, :phrase_key_hash, :phrase, '
            . ':canonical, :canonical_compact, :observed, :observed_compact, '
            . ':recognized_correct, :created_by_user_id, :created_at)'
        );

    $statement->execute([
        ':language' =>
            $language,
        ':phrase_key' =>
            $phraseKey,
        ':phrase_key_hash' =>
            hash(
                'sha256',
                $phraseKey
            ),
        ':phrase' =>
            $phrase,
        ':canonical' =>
            $canonical,
        ':canonical_compact' =>
            $canonicalCompact,
        ':observed' =>
            $observed,
        ':observed_compact' =>
            $observedCompact,
        ':recognized_correct' =>
            $recognizedCorrect
                ? 1
                : 0,
        ':created_by_user_id' =>
            $actorId,
        ':created_at' =>
            $now,
    ]);

    $stats =
        $trainingStats();

    json_response([
        'trained' => true,
        'sample' => [
            'id' =>
                (int) $pdo
                    ->lastInsertId(),
            'phraseKey' =>
                $phraseKey,
            'phrase' =>
                $phrase,
            'canonical' =>
                $canonical,
            'canonicalCompact' =>
                $canonicalCompact,
            'observed' =>
                $observed,
            'observedCompact' =>
                $observedCompact,
            'correct' =>
                $recognizedCorrect,
            'createdAt' =>
                $now,
        ],
        'stats' =>
            $stats[
                $phraseKey
            ] ??
            speech_training_stats_payload(
                $phraseKey,
                $phrase,
                1,
                $recognizedCorrect
                    ? 1
                    : 0
            ),
    ], 201);
}

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
        ':id' =>
            $id,
    ]);

    if (
        $delete->rowCount() !==
        1
    ) {
        api_error(
            'Speech correction was not found.',
            404,
            'not_found'
        );
    }

    json_response([
        'deleted' =>
            true,
        'id' =>
            $id,
    ]);
}

$pair =
    validate_speech_correction_pair(
        $input['observed'] ??
        null,
        $input['canonical'] ??
        null
    );

$matchType =
    speech_correction_match_type(
        $input['matchType'] ??
        'exact'
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

$now =
    time();

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
            $pair[
                'observedCompact'
            ],
        ':canonical' =>
            $pair['canonical'],
        ':canonical_compact' =>
            $pair[
                'canonicalCompact'
            ],
        ':match_type' =>
            $matchType,
        ':enabled' =>
            $enabled ? 1 : 0,
        ':created_by_user_id' =>
            $actorId,
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
            $pair[
                'observedCompact'
            ],
        ':canonical_compact' =>
            $pair[
                'canonicalCompact'
            ],
        ':match_type' =>
            $matchType,
    ]);

    json_response([
        'trained' =>
            true,
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
            $pair[
                'observedCompact'
            ],
        ':canonical' =>
            $pair['canonical'],
        ':canonical_compact' =>
            $pair[
                'canonicalCompact'
            ],
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
catch (
    PDOException $error
) {
    if (
        (string) $error
            ->getCode() ===
            '23000'
    ) {
        api_error(
            'An equivalent speech correction already exists.',
            409,
            'duplicate_correction'
        );
    }

    throw $error;
}

if (
    $statement->rowCount() ===
    0
) {
    $exists =
        $pdo->prepare(
            'SELECT id FROM speech_corrections '
            . 'WHERE id = :id LIMIT 1'
        );

    $exists->execute([
        ':id' =>
            $id,
    ]);

    if (
        !$exists
            ->fetchColumn()
    ) {
        api_error(
            'Speech correction was not found.',
            404,
            'not_found'
        );
    }
}

json_response([
    'updated' =>
        true,
    'id' =>
        $id,
]);
