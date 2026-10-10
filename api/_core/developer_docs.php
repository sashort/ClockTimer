<?php
declare(strict_types=1);

function developer_docs_root(): string
{
    $root = realpath(dirname(__DIR__, 2) . '/docs');

    if ($root === false || !is_dir($root)) {
        throw new RuntimeException('Developer documentation directory is unavailable.');
    }

    return rtrim($root, DIRECTORY_SEPARATOR);
}

function developer_docs_relative_path(string $path): ?string
{
    if (
        $path === '' ||
        str_contains($path, "\0") ||
        str_contains($path, '\\') ||
        str_starts_with($path, '/')
    ) {
        return null;
    }

    $segments = explode('/', $path);
    $clean = [];

    foreach ($segments as $segment) {
        if (
            $segment === '' ||
            $segment === '.' ||
            $segment === '..' ||
            str_starts_with($segment, '.')
        ) {
            return null;
        }

        $clean[] = $segment;
    }

    return implode('/', $clean);
}

function developer_docs_resolve_file(string $root, string $requestedPath): ?string
{
    $relative = developer_docs_relative_path($requestedPath);

    if ($relative === null) {
        return null;
    }

    $rootReal = realpath($root);

    if ($rootReal === false || !is_dir($rootReal)) {
        return null;
    }

    $candidate = realpath(
        $rootReal
        . DIRECTORY_SEPARATOR
        . str_replace('/', DIRECTORY_SEPARATOR, $relative)
    );

    if ($candidate === false || !is_file($candidate)) {
        return null;
    }

    $prefix = rtrim($rootReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;

    if (!str_starts_with($candidate, $prefix)) {
        return null;
    }

    return $candidate;
}

function developer_docs_list(string $root): array
{
    $rootReal = realpath($root);

    if ($rootReal === false || !is_dir($rootReal)) {
        return [];
    }

    $rootReal = rtrim($rootReal, DIRECTORY_SEPARATOR);
    $prefix = $rootReal . DIRECTORY_SEPARATOR;
    $files = [];

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $rootReal,
            FilesystemIterator::SKIP_DOTS
        )
    );

    foreach ($iterator as $entry) {
        if (!$entry->isFile()) {
            continue;
        }

        $real = $entry->getRealPath();

        if ($real === false || !str_starts_with($real, $prefix)) {
            continue;
        }

        $relative = str_replace(
            DIRECTORY_SEPARATOR,
            '/',
            substr($real, strlen($prefix))
        );

        if (developer_docs_relative_path($relative) === null) {
            continue;
        }

        $files[] = [
            'path' => $relative,
            'size' => $entry->getSize(),
            'modified' => $entry->getMTime(),
        ];
    }

    usort(
        $files,
        static fn(array $left, array $right): int =>
            strnatcasecmp($left['path'], $right['path'])
    );

    return $files;
}

function developer_docs_content_type(string $path): string
{
    return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
        'html', 'htm' => 'text/html; charset=utf-8',
        'md', 'markdown' => 'text/markdown; charset=utf-8',
        'txt' => 'text/plain; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'js', 'mjs' => 'text/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'pdf' => 'application/pdf',
        default => 'application/octet-stream',
    };
}
