<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/speech_corrections.php';

$method =
    require_method(
        'GET',
        'POST',
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

$runtimeCorrections =
    static function (
        ?array $languageModel,
        bool $manage = false
    ) use (
        $pdo
    ): array {
        if ($languageModel === null) {
            return [];
        }

        $sql =
            'SELECT MIN(sc.id) AS id, '
            . 'MAX(sc.observed) AS observed, sc.observed_compact, '
            . 'MAX(sc.canonical) AS canonical, sc.canonical_compact, '
            . 'sc.match_type, MAX(sc.enabled) AS enabled, '
            . 'SUM(sc.occurrences) AS occurrences, '
            . 'MAX(sc.updated_at) AS updated_at '
            . 'FROM speech_corrections sc '
            . 'INNER JOIN speech_model_phrases p ON p.id = sc.phrase_id '
            . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
            . 'WHERE COALESCE(c.language_model_component_id, c.id) = :model_id ';

        if (!$manage) {
            $sql .=
                'AND sc.enabled = 1 ';
        }

        $sql .=
            'GROUP BY sc.observed_compact, sc.canonical_compact, sc.match_type '
            . 'ORDER BY occurrences DESC, updated_at DESC, id DESC';

        $statement =
            $pdo->prepare(
                $sql
            );

        $statement->execute([
            ':model_id' =>
                (int) $languageModel['id'],
        ]);

        return array_map(
            static fn (array $row): array => [
                'id' =>
                    (int) $row['id'],
                'language' =>
                    (string) $languageModel[
                        'language_code'
                    ],
                'observed' =>
                    (string) $row['observed'],
                'observedCompact' =>
                    (string) $row[
                        'observed_compact'
                    ],
                'canonical' =>
                    (string) $row['canonical'],
                'canonicalCompact' =>
                    (string) $row[
                        'canonical_compact'
                    ],
                'matchType' =>
                    (string) $row['match_type'],
                'enabled' =>
                    (bool) $row['enabled'],
                'occurrences' =>
                    (int) $row['occurrences'],
                'updatedAt' =>
                    (int) $row['updated_at'],
            ],
            $statement->fetchAll()
        );
    };

$trainingStats =
    static function (
        ?array $languageModel
    ) use (
        $pdo
    ): array {
        if ($languageModel === null) {
            return [];
        }

        $statement =
            $pdo->prepare(
                'SELECT p.phrase_key, p.phrase, '
                . 'COUNT(tc.id) AS sample_count, '
                . 'SUM(tc.recognized_correct) AS correct_count '
                . 'FROM speech_model_phrases p '
                . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
                . 'LEFT JOIN speech_training_contributions tc '
                . 'ON tc.phrase_id = p.id '
                . 'AND tc.active = 1 '
                . 'AND tc.source IN ("guided","manual") '
                . 'WHERE COALESCE(c.language_model_component_id, c.id) = :model_id '
                . 'GROUP BY p.id, p.phrase_key, p.phrase '
                . 'ORDER BY p.phrase_key'
            );

        $statement->execute([
            ':model_id' =>
                (int) $languageModel['id'],
        ]);

        $stats = [];

        foreach (
            $statement->fetchAll()
            as $row
        ) {
            $payload =
                speech_training_stats_payload(
                    (string) $row[
                        'phrase_key'
                    ],
                    (string) $row['phrase'],
                    (int) $row[
                        'sample_count'
                    ],
                    (int) $row[
                        'correct_count'
                    ]
                );

            $stats[
                $payload['phraseKey']
            ] =
                $payload;
        }

        return $stats;
    };

$contributorStats =
    static function (
        ?array $languageModel
    ) use (
        $pdo
    ): array {
        if ($languageModel === null) {
            return [];
        }

        $statement =
            $pdo->prepare(
                'SELECT tc.user_id, '
                . 'u.username, u.preferred_name, u.first_name, u.last_name, '
                . 'COUNT(*) AS contribution_count, '
                . 'SUM(tc.source IN ("guided","manual")) AS sample_count, '
                . 'SUM(tc.source IN ("guided","manual") AND tc.recognized_correct = 0) AS alternative_count, '
                . 'SUM(tc.source = "correction") AS correction_count, '
                . 'COUNT(DISTINCT tc.phrase_id) AS phrase_count '
                . 'FROM speech_training_contributions tc '
                . 'INNER JOIN speech_model_phrases p ON p.id = tc.phrase_id '
                . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
                . 'LEFT JOIN users u ON u.id = tc.user_id '
                . 'WHERE tc.active = 1 '
                . 'AND COALESCE(c.language_model_component_id, c.id) = :model_id '
                . 'GROUP BY tc.user_id, u.username, u.preferred_name, '
                . 'u.first_name, u.last_name '
                . 'ORDER BY contribution_count DESC, tc.user_id'
            );

        $statement->execute([
            ':model_id' =>
                (int) $languageModel['id'],
        ]);

        return array_map(
            static function (array $row): array {
                $display =
                    trim(
                        (string) (
                            $row[
                                'preferred_name'
                            ] ??
                            ''
                        )
                    );

                if (
                    $display === '' &&
                    (
                        $row['first_name'] ??
                        null
                    ) !== null
                ) {
                    $display =
                        trim(
                            (string) $row[
                                'first_name'
                            ] .
                            ' ' .
                            (string) (
                                $row[
                                    'last_name'
                                ] ??
                                ''
                            )
                        );
                }

                return [
                    'userId' =>
                        (int) $row['user_id'],
                    'username' =>
                        $row['username'] ===
                            null
                            ? null
                            : (string) $row[
                                'username'
                            ],
                    'displayName' =>
                        $display === ''
                            ? null
                            : $display,
                    'contributions' =>
                        (int) $row[
                            'contribution_count'
                        ],
                    'samples' =>
                        (int) $row[
                            'sample_count'
                        ],
                    'alternatives' =>
                        (int) $row[
                            'alternative_count'
                        ],
                    'corrections' =>
                        (int) $row[
                            'correction_count'
                        ],
                    'phrases' =>
                        (int) $row[
                            'phrase_count'
                        ],
                ];
            },
            $statement->fetchAll()
        );
    };

$phraseTraining =
    static function (
        array $languageModel,
        string $phraseKey,
        ?string $componentKey = null
    ) use (
        $pdo
    ): array {
        $sql =
            'SELECT p.id, p.phrase_key, p.phrase, '
            . 'c.id AS component_id, c.component_key '
            . 'FROM speech_model_phrases p '
            . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
            . 'WHERE COALESCE(c.language_model_component_id, c.id) = :model_id '
            . 'AND p.phrase_key_hash = :phrase_key_hash '
            . 'AND p.phrase_key = :phrase_key ';

        $parameters = [
            ':model_id' =>
                (int) $languageModel['id'],
            ':phrase_key_hash' =>
                hash(
                    'sha256',
                    $phraseKey
                ),
            ':phrase_key' =>
                $phraseKey,
        ];

        if ($componentKey !== null) {
            $sql .=
                'AND c.component_key_hash = :component_key_hash '
                . 'AND c.component_key = :component_key ';

            $parameters[
                ':component_key_hash'
            ] =
                hash(
                    'sha256',
                    $componentKey
                );

            $parameters[
                ':component_key'
            ] =
                $componentKey;
        }

        $sql .=
            'ORDER BY p.id LIMIT 1';

        $find =
            $pdo->prepare(
                $sql
            );

        $find->execute(
            $parameters
        );

        $phraseRow =
            $find->fetch();

        if (!$phraseRow) {
            return [
                'samples' => [],
                'variants' => [],
                'contributors' => [],
            ];
        }

        $phraseId =
            (int) $phraseRow['id'];

        $statement =
            $pdo->prepare(
                'SELECT id, source, canonical, canonical_compact, '
                . 'observed, observed_compact, match_type, recognized_correct, '
                . 'user_id, training_style, prompt_index, recognizer, pipeline, '
                . 'runtime_revision, active, revoked_at, revoked_by_user_id, '
                . 'revocation_reason, created_at '
                . 'FROM speech_training_contributions '
                . 'WHERE phrase_id = :phrase_id '
                . 'ORDER BY id DESC '
                . 'LIMIT 250'
            );

        $statement->execute([
            ':phrase_id' =>
                $phraseId,
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
                'source' =>
                    (string) $row['source'],
                'canonical' =>
                    (string) $row[
                        'canonical'
                    ],
                'canonicalCompact' =>
                    (string) $row[
                        'canonical_compact'
                    ],
                'observed' =>
                    (string) $row[
                        'observed'
                    ],
                'observedCompact' =>
                    (string) $row[
                        'observed_compact'
                    ],
                'matchType' =>
                    (string) $row[
                        'match_type'
                    ],
                'correct' =>
                    (bool) $row[
                        'recognized_correct'
                    ],
                'userId' =>
                    (int) $row['user_id'],
                'trainingStyle' =>
                    $row['training_style'],
                'promptIndex' =>
                    $row['prompt_index'] ===
                        null
                        ? null
                        : (int) $row[
                            'prompt_index'
                        ],
                'recognizer' =>
                    (string) $row[
                        'recognizer'
                    ],
                'pipeline' =>
                    $row['pipeline'],
                'runtimeRevision' =>
                    $row[
                        'runtime_revision'
                    ],
                'active' =>
                    (bool) $row['active'],
                'revokedAt' =>
                    $row['revoked_at'] ===
                        null
                        ? null
                        : (int) $row[
                            'revoked_at'
                        ],
                'revokedByUserId' =>
                    $row[
                        'revoked_by_user_id'
                    ] ===
                        null
                        ? null
                        : (int) $row[
                            'revoked_by_user_id'
                        ],
                'revocationReason' =>
                    $row[
                        'revocation_reason'
                    ],
                'createdAt' =>
                    (int) $row[
                        'created_at'
                    ],
            ];

            $samples[] =
                $sample;

            if (
                !$sample['active'] ||
                $sample['source'] ===
                    'correction'
            ) {
                continue;
            }

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
                        $sample[
                            'observed'
                        ],
                    'observedCompact' =>
                        $variantKey,
                    'count' => 0,
                    'correct' => 0,
                    'incorrect' => 0,
                    'contributors' => [],
                    'lastSeenAt' =>
                        $sample[
                            'createdAt'
                        ],
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
            ]['contributors'][
                $sample['userId']
            ] =
                true;

            $variants[
                $variantKey
            ]['lastSeenAt'] =
                max(
                    $variants[
                        $variantKey
                    ]['lastSeenAt'],
                    $sample[
                        'createdAt'
                    ]
                );
        }

        foreach (
            $variants
            as &$variant
        ) {
            $variant[
                'contributorCount'
            ] =
                count(
                    $variant[
                        'contributors'
                    ]
                );

            unset(
                $variant[
                    'contributors'
                ]
            );
        }

        unset($variant);

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

        $contributors =
            $pdo->prepare(
                'SELECT tc.user_id, u.username, u.preferred_name, '
                . 'u.first_name, u.last_name, COUNT(*) AS contribution_count, '
                . 'SUM(tc.source IN ("guided","manual")) AS sample_count, '
                . 'SUM(tc.source IN ("guided","manual") AND tc.recognized_correct = 0) AS alternative_count, '
                . 'SUM(tc.source = "correction") AS correction_count '
                . 'FROM speech_training_contributions tc '
                . 'LEFT JOIN users u ON u.id = tc.user_id '
                . 'WHERE tc.phrase_id = :phrase_id '
                . 'AND tc.active = 1 '
                . 'GROUP BY tc.user_id, u.username, u.preferred_name, '
                . 'u.first_name, u.last_name '
                . 'ORDER BY contribution_count DESC, tc.user_id'
            );

        $contributors->execute([
            ':phrase_id' =>
                $phraseId,
        ]);

        return [
            'phraseId' =>
                $phraseId,
            'phraseKey' =>
                (string) $phraseRow[
                    'phrase_key'
                ],
            'phrase' =>
                (string) $phraseRow[
                    'phrase'
                ],
            'componentId' =>
                (int) $phraseRow[
                    'component_id'
                ],
            'componentKey' =>
                (string) $phraseRow[
                    'component_key'
                ],
            'samples' =>
                $samples,
            'variants' =>
                array_values(
                    $variants
                ),
            'contributors' =>
                array_map(
                    static fn (
                        array $row
                    ): array => [
                        'userId' =>
                            (int) $row[
                                'user_id'
                            ],
                        'username' =>
                            $row[
                                'username'
                            ],
                        'displayName' =>
                            trim(
                                (string) (
                                    $row[
                                        'preferred_name'
                                    ] ??
                                    (
                                        (
                                            $row[
                                                'first_name'
                                            ] ??
                                            ''
                                        ) .
                                        ' ' .
                                        (
                                            $row[
                                                'last_name'
                                            ] ??
                                            ''
                                        )
                                    )
                                )
                            ) ?: null,
                        'contributions' =>
                            (int) $row[
                                'contribution_count'
                            ],
                        'samples' =>
                            (int) $row[
                                'sample_count'
                            ],
                        'alternatives' =>
                            (int) $row[
                                'alternative_count'
                            ],
                        'corrections' =>
                            (int) $row[
                                'correction_count'
                            ],
                    ],
                    $contributors
                        ->fetchAll()
                ),
        ];
    };

$languageModel =
    speech_model_root(
        $pdo,
        $language,
        false
    );

if ($method === 'GET') {
    $manage =
        ($_GET['manage'] ?? null) ===
        '1';

    $manageUser = null;

    if ($manage) {
        $manageUser =
            optional_current_user();

        if ($manageUser === null) {
            authorize_guarded_access(
                [
                    PERMISSION_DEVELOPER_PREVIEW,
                    PERMISSION_DEVELOPER
                ],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            );
        }
    }

    $corrections =
        $runtimeCorrections(
            $languageModel,
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
        'model' =>
            $languageModel === null
                ? null
                : [
                    'id' =>
                        (int) $languageModel[
                            'id'
                        ],
                    'componentKey' =>
                        (string) $languageModel[
                            'component_key'
                        ],
                    'name' =>
                        (string) $languageModel[
                            'name'
                        ],
                ],
        'corrections' =>
            $corrections,
        'revision' =>
            $revision,
    ];

    if ($manage) {
        $payload['trainingStats'] =
            $trainingStats(
                $languageModel
            );

        $payload['contributors'] =
            $contributorStats(
                $languageModel
            );

        $payload['minimumSamples'] =
            SPEECH_TRAINING_MIN_SAMPLES;

        $payload['targetAccuracy'] =
            SPEECH_TRAINING_TARGET_ACCURACY;

        $payload['canTrain'] =
            $manageUser !== null;

        $payload['canWrite'] =
            $manageUser !== null &&
            permission_mask_allows(
                (int) $manageUser[
                    'permissions'
                ],
                PERMISSION_DEVELOPER
            );

        $payload['csrfToken'] =
            csrf_token();

        if (
            $languageModel !==
                null &&
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

            $componentKey =
                isset(
                    $_GET[
                        'componentKey'
                    ]
                )
                    ? speech_training_component_key(
                        $_GET[
                            'componentKey'
                        ]
                    )
                    : null;

            $payload['training'] =
                $phraseTraining(
                    $languageModel,
                    $phraseKey,
                    $componentKey
                );
        }
    }

    json_response(
        $payload
    );
}

$input =
    json_input();

$inputLanguage =
    speech_correction_language(
        $input['language'] ??
        $language
    );

$action =
    is_string(
        $input['action'] ??
        null
    )
        ? strtolower(
            trim(
                (string) $input[
                    'action'
                ]
            )
        )
        : (
            $method === 'POST'
                ? 'correction'
                : 'contribution'
        );

if (
    $method === 'POST' &&
    in_array(
        $action,
        ['sample', 'correction'],
        true
    )
) {
    $user =
        $action ===
            'correction'
                ? require_permission(
                    PERMISSION_DEVELOPER
                )
                : current_user();

    require_csrf();

    $actorId =
        (int) $user['id'];

    $languageModel =
        speech_model_root(
            $pdo,
            $inputLanguage,
            false
        );

    if ($languageModel === null) {
        api_error(
            'Speech language model was not found.',
            404,
            'speech_model_not_found'
        );
    }

    $componentKey =
        speech_training_component_key(
            $input[
                'componentKey'
            ] ??
            'default'
        );

    $phraseKey =
        speech_training_phrase_key(
            $input[
                'phraseKey'
            ] ??
            null
        );

    $phrase =
        speech_training_phrase(
            $input['phrase'] ??
            null
        );

    $component =
        speech_model_component(
            $pdo,
            $languageModel,
            $componentKey,
            true
        );

    $phraseRow =
        speech_model_phrase(
            $pdo,
            (int) $component['id'],
            $phraseKey,
            $phrase,
            true
        );

    if ($action === 'correction') {
        $pair =
            validate_speech_correction_pair(
                $input[
                    'observed'
                ] ??
                    null,
                $input[
                    'canonical'
                ] ??
                    null
            );

        $source =
            'correction';

        $matchType =
            speech_correction_match_type(
                $input[
                    'matchType'
                ] ??
                'exact'
            );

        $recognizedCorrect =
            false;

        $canonical =
            $pair['canonical'];

        $canonicalCompact =
            $pair[
                'canonicalCompact'
            ];

        $observed =
            $pair['observed'];

        $observedCompact =
            $pair[
                'observedCompact'
            ];
    } else {
        $canonicalRaw =
            $input[
                'canonical'
            ] ??
            null;

        $observedRaw =
            $input[
                'observed'
            ] ??
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
            strlen($canonical) > 500 ||
            strlen($observed) > 500
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

        $source =
            (
                $input[
                    'source'
                ] ??
                'manual'
            ) ===
                'guided'
                    ? 'guided'
                    : 'manual';

        $matchType =
            'exact';
    }

    $trainingStyle =
        isset(
            $input[
                'trainingStyle'
            ]
        ) &&
        is_string(
            $input[
                'trainingStyle'
            ]
        )
            ? trim(
                $input[
                    'trainingStyle'
                ]
            )
            : null;

    if (
        $trainingStyle !==
            null &&
        strlen($trainingStyle) >
            100
    ) {
        api_error(
            'trainingStyle is too long.',
            422,
            'invalid_argument'
        );
    }

    $promptIndex =
        $input[
            'promptIndex'
        ] ??
        null;

    if (
        $promptIndex !==
            null &&
        (
            !is_int(
                $promptIndex
            ) ||
            $promptIndex < 0 ||
            $promptIndex > 65535
        )
    ) {
        api_error(
            'promptIndex is invalid.',
            422,
            'invalid_argument'
        );
    }

    $pipeline =
        isset(
            $input['pipeline']
        ) &&
        is_string(
            $input['pipeline']
        )
            ? substr(
                trim(
                    $input[
                        'pipeline'
                    ]
                ),
                0,
                32
            )
            : null;

    $runtimeRevision =
        isset(
            $input[
                'runtimeRevision'
            ]
        ) &&
        is_string(
            $input[
                'runtimeRevision'
            ]
        )
            ? substr(
                trim(
                    $input[
                        'runtimeRevision'
                    ]
                ),
                0,
                100
            )
            : null;

    $metadata =
        isset(
            $input['metadata']
        ) &&
        is_array(
            $input['metadata']
        )
            ? json_encode(
                $input['metadata'],
                JSON_UNESCAPED_UNICODE |
                JSON_UNESCAPED_SLASHES |
                JSON_THROW_ON_ERROR
            )
            : null;

    $now =
        time();

    try {
        $pdo->beginTransaction();

        $statement =
            $pdo->prepare(
                'INSERT INTO speech_training_contributions '
                . '(phrase_id, user_id, source, canonical, canonical_compact, '
                . 'observed, observed_compact, match_type, mapping_hash, recognized_correct, '
                . 'training_style, prompt_index, recognizer, pipeline, '
                . 'runtime_revision, metadata, active, created_at) '
                . 'VALUES (:phrase_id, :user_id, :source, :canonical, '
                . ':canonical_compact, :observed, :observed_compact, :match_type, '
                . ':mapping_hash, :recognized_correct, :training_style, :prompt_index, "sherpa", '
                . ':pipeline, :runtime_revision, :metadata, 1, :created_at)'
            );

        $statement->execute([
            ':phrase_id' =>
                (int) $phraseRow['id'],
            ':user_id' =>
                $actorId,
            ':source' =>
                $source,
            ':canonical' =>
                $canonical,
            ':canonical_compact' =>
                $canonicalCompact,
            ':observed' =>
                $observed,
            ':observed_compact' =>
                $observedCompact,
            ':match_type' =>
                $matchType,
            ':mapping_hash' =>
                hash(
                    'sha256',
                    $observedCompact .
                    "\x1F" .
                    $canonicalCompact .
                    "\x1F" .
                    $matchType
                ),
            ':recognized_correct' =>
                $recognizedCorrect
                    ? 1
                    : 0,
            ':training_style' =>
                $trainingStyle,
            ':prompt_index' =>
                $promptIndex,
            ':pipeline' =>
                $pipeline,
            ':runtime_revision' =>
                $runtimeRevision,
            ':metadata' =>
                $metadata,
            ':created_at' =>
                $now,
        ]);

        $contributionId =
            (int) $pdo
                ->lastInsertId();

        rebuild_speech_corrections(
            $pdo,
            (int) $languageModel[
                'id'
            ],
            [
                (int) $phraseRow[
                    'id'
                ]
            ]
        );

        $pdo->commit();
    } catch (
        Throwable $error
    ) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    $stats =
        $trainingStats(
            $languageModel
        );

    json_response([
        'trained' =>
            true,
        'contribution' => [
            'id' =>
                $contributionId,
            'userId' =>
                $actorId,
            'source' =>
                $source,
            'phraseId' =>
                (int) $phraseRow[
                    'id'
                ],
            'phraseKey' =>
                $phraseKey,
            'componentId' =>
                (int) $component[
                    'id'
                ],
            'componentKey' =>
                $componentKey,
            'canonical' =>
                $canonical,
            'canonicalCompact' =>
                $canonicalCompact,
            'observed' =>
                $observed,
            'observedCompact' =>
                $observedCompact,
            'matchType' =>
                $matchType,
            'correct' =>
                $recognizedCorrect,
            'createdAt' =>
                $now,
        ],
        'sample' =>
            $action ===
                'sample'
                    ? [
                        'id' =>
                            $contributionId,
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
                    ]
                    : null,
        'stats' =>
            $stats[
                $phraseKey
            ] ??
            speech_training_stats_payload(
                $phraseKey,
                $phrase,
                $action ===
                    'sample'
                        ? 1
                        : 0,
                $action ===
                    'sample' &&
                $recognizedCorrect
                    ? 1
                    : 0
            ),
        'corrections' =>
            $runtimeCorrections(
                $languageModel,
                true
            ),
    ], 201);
}

$writeUser =
    require_permission(
        PERMISSION_DEVELOPER
    );

require_csrf();

$actorId =
    (int) $writeUser['id'];

$languageModel =
    speech_model_root(
        $pdo,
        $inputLanguage,
        false
    );

if (
    $languageModel ===
    null
) {
    api_error(
        'Speech language model was not found.',
        404,
        'speech_model_not_found'
    );
}

if (
    $method ===
        'POST' &&
    $action ===
        'rebuild'
) {
    $phraseIds = null;
    $phraseId = null;
    $componentId = null;

    if (
        isset(
            $input[
                'phraseKey'
            ]
        )
    ) {
        $phraseKey =
            speech_training_phrase_key(
                $input[
                    'phraseKey'
                ]
            );

        $componentKey =
            isset(
                $input[
                    'componentKey'
                ]
            )
                ? speech_training_component_key(
                    $input[
                        'componentKey'
                    ]
                )
                : null;

        $training =
            $phraseTraining(
                $languageModel,
                $phraseKey,
                $componentKey
            );

        if (
            !isset(
                $training[
                    'phraseId'
                ]
            )
        ) {
            api_error(
                'Speech phrase was not found.',
                404,
                'speech_phrase_not_found'
            );
        }

        $phraseId =
            (int) $training[
                'phraseId'
            ];

        $componentId =
            (int) $training[
                'componentId'
            ];

        $phraseIds = [
            $phraseId,
        ];
    }

    try {
        $pdo->beginTransaction();

        $count =
            rebuild_speech_corrections(
                $pdo,
                (int) $languageModel[
                    'id'
                ],
                $phraseIds
            );

        speech_training_audit_event(
            $pdo,
            $actorId,
            $phraseId === null
                ? 'model-rebuilt'
                : 'phrase-rebuilt',
            (int) $languageModel[
                'id'
            ],
            $componentId,
            $phraseId,
            null,
            null,
            [
                'derivedCorrections' =>
                    $count,
            ]
        );

        $pdo->commit();
    } catch (
        Throwable $error
    ) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    json_response([
        'rebuilt' =>
            true,
        'phraseId' =>
            $phraseId,
        'derivedCorrections' =>
            $count,
        'corrections' =>
            $runtimeCorrections(
                $languageModel,
                true
            ),
    ]);
}

if (
    $method ===
        'DELETE' &&
    $action ===
        'reset'
) {
    $modelId =
        (int) $languageModel['id'];

    try {
        $pdo->beginTransaction();

        $pdo->prepare(
            'SET @speech_training_actor_user_id = :actor_user_id'
        )->execute([
            ':actor_user_id' =>
                $actorId,
        ]);

        $phraseIds =
            $pdo->prepare(
                'SELECT p.id '
                . 'FROM speech_model_phrases p '
                . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
                . 'WHERE COALESCE(c.language_model_component_id, c.id) = :model_id'
            );

        $phraseIds->execute([
            ':model_id' =>
                $modelId,
        ]);

        $ids =
            array_map(
                'intval',
                $phraseIds
                    ->fetchAll(
                        PDO::FETCH_COLUMN
                    )
            );

        $deletedContributions = 0;
        $deletedPhrases = 0;

        if ($ids !== []) {
            $placeholders =
                implode(
                    ',',
                    array_fill(
                        0,
                        count($ids),
                        '?'
                    )
                );

            $deleteCorrections =
                $pdo->prepare(
                    'DELETE FROM speech_corrections '
                    . 'WHERE phrase_id IN (' .
                    $placeholders .
                    ')'
                );

            $deleteCorrections
                ->execute(
                    $ids
                );

            $deleteContributions =
                $pdo->prepare(
                    'DELETE FROM speech_training_contributions '
                    . 'WHERE phrase_id IN (' .
                    $placeholders .
                    ')'
                );

            $deleteContributions
                ->execute(
                    $ids
                );

            $deletedContributions =
                $deleteContributions
                    ->rowCount();

            $deletePhrases =
                $pdo->prepare(
                    'DELETE FROM speech_model_phrases '
                    . 'WHERE id IN (' .
                    $placeholders .
                    ')'
                );

            $deletePhrases
                ->execute(
                    $ids
                );

            $deletedPhrases =
                $deletePhrases
                    ->rowCount();
        }

        speech_training_audit_event(
            $pdo,
            $actorId,
            'model-reset',
            $modelId,
            null,
            null,
            null,
            null,
            [
                'deletedContributions' =>
                    $deletedContributions,
                'deletedPhrases' =>
                    $deletedPhrases,
            ]
        );

        $pdo->exec(
            'SET @speech_training_actor_user_id = NULL'
        );

        $pdo->commit();
    } catch (
        Throwable $error
    ) {
        try {
            $pdo->exec(
                'SET @speech_training_actor_user_id = NULL'
            );
        } catch (
            Throwable
        ) {
        }

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    json_response([
        'reset' =>
            true,
        'language' =>
            $inputLanguage,
        'deletedContributions' =>
            $deletedContributions,
        'deletedPhrases' =>
            $deletedPhrases,
    ]);
}

if (
    $method ===
        'DELETE' &&
    in_array(
        $action,
        ['contribution', 'contributions'],
        true
    )
) {
    $where = [
        'tc.active = 1',
        'COALESCE(c.language_model_component_id, c.id) = :model_id',
    ];

    $parameters = [
        ':model_id' =>
            (int) $languageModel[
                'id'
            ],
    ];

    if ($action === 'contribution') {
        $id =
            require_positive_int(
                $input,
                'id'
            );

        $where[] =
            'tc.id = :contribution_id';

        $parameters[
            ':contribution_id'
        ] =
            $id;
    } else {
        $hasTarget =
            false;

        if (
            array_key_exists(
                'userId',
                $input
            )
        ) {
            $userId =
                require_positive_int(
                    $input,
                    'userId'
                );

            $where[] =
                'tc.user_id = :user_id';

            $parameters[
                ':user_id'
            ] =
                $userId;

            $hasTarget =
                true;
        }

        if (
            isset(
                $input[
                    'phraseKey'
                ]
            )
        ) {
            $phraseKey =
                speech_training_phrase_key(
                    $input[
                        'phraseKey'
                    ]
                );

            $where[] =
                'p.phrase_key_hash = :phrase_key_hash';

            $where[] =
                'p.phrase_key = :phrase_key';

            $parameters[
                ':phrase_key_hash'
            ] =
                hash(
                    'sha256',
                    $phraseKey
                );

            $parameters[
                ':phrase_key'
            ] =
                $phraseKey;

            $hasTarget =
                true;
        }

        if (
            isset(
                $input[
                    'componentKey'
                ]
            )
        ) {
            $componentKey =
                speech_training_component_key(
                    $input[
                        'componentKey'
                    ]
                );

            $where[] =
                'c.component_key_hash = :component_key_hash';

            $where[] =
                'c.component_key = :component_key';

            $parameters[
                ':component_key_hash'
            ] =
                hash(
                    'sha256',
                    $componentKey
                );

            $parameters[
                ':component_key'
            ] =
                $componentKey;

            $hasTarget =
                true;
        }

        foreach (
            [
                'observed' =>
                    'tc.observed_compact',
                'canonical' =>
                    'tc.canonical_compact',
            ]
            as $inputKey =>
                $column
        ) {
            if (
                isset(
                    $input[
                        $inputKey
                    ]
                ) &&
                is_string(
                    $input[
                        $inputKey
                    ]
                )
            ) {
                $where[] =
                    $column .
                    ' = :' .
                    $inputKey;

                $parameters[
                    ':' .
                    $inputKey
                ] =
                    compact_speech_correction_text(
                        $input[
                            $inputKey
                        ]
                    );

                $hasTarget =
                    true;
            }
        }

        if (!$hasTarget) {
            api_error(
                'Removing contributions requires at least one target filter.',
                422,
                'invalid_argument'
            );
        }
    }

    $find =
        $pdo->prepare(
            'SELECT tc.id, tc.user_id, tc.phrase_id '
            . 'FROM speech_training_contributions tc '
            . 'INNER JOIN speech_model_phrases p ON p.id = tc.phrase_id '
            . 'INNER JOIN speech_model_components c ON c.id = p.component_id '
            . 'WHERE ' .
            implode(
                ' AND ',
                $where
            )
        );

    $find->execute(
        $parameters
    );

    $rows =
        $find->fetchAll();

    if ($rows === []) {
        api_error(
            'No active training contributions matched.',
            404,
            'training_contribution_not_found'
        );
    }

    $ids =
        array_map(
            static fn (
                array $row
            ): int =>
                (int) $row['id'],
            $rows
        );

    $phraseIds =
        array_values(
            array_unique(
                array_map(
                    static fn (
                        array $row
                    ): int =>
                        (int) $row[
                            'phrase_id'
                        ],
                    $rows
                )
            )
        );

    $idPlaceholders =
        implode(
            ',',
            array_fill(
                0,
                count($ids),
                '?'
            )
        );

    $reason =
        isset(
            $input['reason']
        ) &&
        is_string(
            $input['reason']
        )
            ? substr(
                trim(
                    $input['reason']
                ),
                0,
                500
            )
            : 'Removed from speech training';

    try {
        $pdo->beginTransaction();

        $update =
            $pdo->prepare(
                'UPDATE speech_training_contributions '
                . 'SET active = 0, revoked_at = ?, '
                . 'revoked_by_user_id = ?, revocation_reason = ? '
                . 'WHERE id IN (' .
                $idPlaceholders .
                ')'
            );

        $update->execute([
            time(),
            $actorId,
            $reason,
            ...$ids,
        ]);

        $derived =
            rebuild_speech_corrections(
                $pdo,
                (int) $languageModel[
                    'id'
                ],
                $phraseIds
            );

        speech_training_audit_event(
            $pdo,
            $actorId,
            'contributions-recalculated',
            (int) $languageModel[
                'id'
            ],
            null,
            count($phraseIds) ===
                1
                    ? $phraseIds[0]
                    : null,
            null,
            null,
            [
                'removedContributionIds' =>
                    $ids,
                'phraseIds' =>
                    $phraseIds,
                'derivedCorrections' =>
                    $derived,
                'reason' =>
                    $reason,
            ]
        );

        $pdo->commit();
    } catch (
        Throwable $error
    ) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }

    json_response([
        'removed' =>
            count($ids),
        'contributionIds' =>
            $ids,
        'phraseIds' =>
            $phraseIds,
        'corrections' =>
            $runtimeCorrections(
                $languageModel,
                true
            ),
    ]);
}

api_error(
    'Unknown speech training action.',
    422,
    'invalid_action'
);
