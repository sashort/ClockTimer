<?php
declare(strict_types=1);

/** Shared timing contract for command preflight and persisted session writes. */
final class TripSessionTimingInput
{
    public static function parse(array $input): array
    {
        $breakOnly = $input['breakOnly'] ?? false;
        if (!is_bool($breakOnly)) throw new InvalidArgumentException('breakOnly must be a boolean.');
        $standard = $input['standardTimeMilliseconds'] ?? null;
        if ($breakOnly) {
            if ($standard !== null) throw new InvalidArgumentException('A break-only session has no standard time.');
        } else {
            if (is_string($standard) && ctype_digit($standard)) $standard = (int) $standard;
            if (!is_int($standard) || $standard < 1) throw new InvalidArgumentException('standardTimeMilliseconds must be a positive integer.');
        }
        return ['breakOnly'=>$breakOnly, 'standardTimeMilliseconds'=>$standard];
    }
}

function require_trip_session_timing(array $input): array
{
    try { return TripSessionTimingInput::parse($input); }
    catch (InvalidArgumentException $error) { api_error($error->getMessage(), 422, 'invalid_argument'); }
}
