<?php
declare(strict_types=1);
return [
    "ALTER TABLE trips DROP CONSTRAINT chk_trips_standard_time, MODIFY standard_time_ms BIGINT UNSIGNED NULL, ADD COLUMN break_only TINYINT(1) NOT NULL DEFAULT 0",
    "UPDATE trips t SET t.break_only = 1, t.standard_time_ms = NULL, t.non_production = 0, t.counted_time_ms = 0 WHERE EXISTS (SELECT 1 FROM trip_events e INNER JOIN event_types k ON k.id = e.event_type_id WHERE e.trip_id = t.id AND k.name = 'trip.started' AND JSON_EXTRACT(e.value, '$.breakOnly') = true)",
    "ALTER TABLE trips ADD CONSTRAINT chk_trips_standard_time CHECK ((break_only = 1 AND standard_time_ms IS NULL AND non_production = 0) OR (break_only = 0 AND standard_time_ms IS NOT NULL AND standard_time_ms > 0))"
];
