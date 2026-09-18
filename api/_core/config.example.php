<?php
declare(strict_types=1);

return [
    'admin_sql_enabled' => false,
    'admin_migrations_enabled' => false,
    // Keep the real key in /etc/clocktimer/config.php or OPENAI_API_KEY, never in Git.
    'openai_api_key' => '',
    'calendar_search_model' => 'gpt-5.5',
    'calendar_extraction_model' => 'gpt-5.5',
    'calendar_auto_refresh' => false, // Enable after configuring the key and store profile.
    'calendar_cache_directory' => '/var/lib/clocktimer/calendars',
    // Optional calendar_profiles: see docs/calendar-ranges.md for regional/store settings.
    'database' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'trip_management',
        'username' => 'clocktimer_api',
        'password' => 'replace-me',
    ],
];
