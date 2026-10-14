<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

$method = require_method('GET', 'PUT');
$userId = authenticated_user_id();

function speech_timing_profile(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT continuation_pause_mean_ms, continuation_pause_variance_ms2, continuation_pause_samples, '
        . 'stream_separation_mean_ms, stream_separation_variance_ms2, stream_separation_samples, updated_at '
        . 'FROM user_speech_profiles WHERE user_id = :user_id LIMIT 1'
    );
    $statement->execute([':user_id' => $userId]);
    $row = $statement->fetch();

    if (!$row) {
        return [
            'continuationPauseMeanMs' => null,
            'continuationPauseVarianceMs2' => null,
            'continuationPauseSamples' => 0,
            'streamSeparationMeanMs' => null,
            'streamSeparationVarianceMs2' => null,
            'streamSeparationSamples' => 0,
            'updatedAt' => null,
        ];
    }

    return [
        'continuationPauseMeanMs' => $row['continuation_pause_mean_ms'] === null ? null : (int) $row['continuation_pause_mean_ms'],
        'continuationPauseVarianceMs2' => $row['continuation_pause_variance_ms2'] === null ? null : (int) $row['continuation_pause_variance_ms2'],
        'continuationPauseSamples' => (int) $row['continuation_pause_samples'],
        'streamSeparationMeanMs' => $row['stream_separation_mean_ms'] === null ? null : (int) $row['stream_separation_mean_ms'],
        'streamSeparationVarianceMs2' => $row['stream_separation_variance_ms2'] === null ? null : (int) $row['stream_separation_variance_ms2'],
        'streamSeparationSamples' => (int) $row['stream_separation_samples'],
        'updatedAt' => (int) $row['updated_at'],
    ];
}

function optional_uint(array $input, string $name, int $maximum): ?int
{
    if (!array_key_exists($name, $input) || $input[$name] === null) {
        return null;
    }

    $value = $input[$name];

    if (is_string($value) && ctype_digit($value)) {
        $value = (int) $value;
    }

    if (!is_int($value) || $value < 0 || $value > $maximum) {
        api_error($name . ' must be an unsigned integer in range.', 422, 'invalid_argument');
    }

    return $value;
}

if ($method === 'GET') {
    json_response([
        'profile' => speech_timing_profile(db(), $userId),
    ]);
}

require_csrf();
$input = json_input();

$allowed = [
    'continuationPauseMeanMs',
    'continuationPauseVarianceMs2',
    'continuationPauseSamples',
    'streamSeparationMeanMs',
    'streamSeparationVarianceMs2',
    'streamSeparationSamples',
];

foreach ($input as $key => $_value) {
    if (!in_array($key, $allowed, true)) {
        api_error('Unknown speech timing field.', 422, 'invalid_argument');
    }
}

$continuationMean = optional_uint($input, 'continuationPauseMeanMs', 2500);
$continuationVariance = optional_uint($input, 'continuationPauseVarianceMs2', 6250000);
$continuationSamples = optional_uint($input, 'continuationPauseSamples', 4294967295) ?? 0;
$separationMean = optional_uint($input, 'streamSeparationMeanMs', 5000);
$separationVariance = optional_uint($input, 'streamSeparationVarianceMs2', 25000000);
$separationSamples = optional_uint($input, 'streamSeparationSamples', 4294967295) ?? 0;

if ($continuationSamples === 0) {
    $continuationMean = null;
    $continuationVariance = null;
}
elseif ($continuationMean === null || $continuationVariance === null) {
    api_error('Continuation timing samples require a mean and variance.', 422, 'invalid_argument');
}

if ($separationSamples === 0) {
    $separationMean = null;
    $separationVariance = null;
}
elseif ($separationMean === null || $separationVariance === null) {
    api_error('Stream-separation samples require a mean and variance.', 422, 'invalid_argument');
}

$updatedAt = (int) round(microtime(true) * 1000);

$statement = db()->prepare(
    'INSERT INTO user_speech_profiles ('
    . 'user_id, continuation_pause_mean_ms, continuation_pause_variance_ms2, continuation_pause_samples, '
    . 'stream_separation_mean_ms, stream_separation_variance_ms2, stream_separation_samples, updated_at'
    . ') VALUES ('
    . ':user_id, :continuation_mean, :continuation_variance, :continuation_samples, '
    . ':separation_mean, :separation_variance, :separation_samples, :updated_at'
    . ') ON DUPLICATE KEY UPDATE '
    . 'continuation_pause_mean_ms = VALUES(continuation_pause_mean_ms), '
    . 'continuation_pause_variance_ms2 = VALUES(continuation_pause_variance_ms2), '
    . 'continuation_pause_samples = VALUES(continuation_pause_samples), '
    . 'stream_separation_mean_ms = VALUES(stream_separation_mean_ms), '
    . 'stream_separation_variance_ms2 = VALUES(stream_separation_variance_ms2), '
    . 'stream_separation_samples = VALUES(stream_separation_samples), '
    . 'updated_at = VALUES(updated_at)'
);

$statement->execute([
    ':user_id' => $userId,
    ':continuation_mean' => $continuationMean,
    ':continuation_variance' => $continuationVariance,
    ':continuation_samples' => $continuationSamples,
    ':separation_mean' => $separationMean,
    ':separation_variance' => $separationVariance,
    ':separation_samples' => $separationSamples,
    ':updated_at' => $updatedAt,
]);

json_response([
    'profile' => speech_timing_profile(db(), $userId),
]);
