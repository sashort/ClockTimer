<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/_core/developer_docs.php';

$passed = 0;

function expect(bool $condition, string $message = 'Assertion failed'): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function test(string $name, callable $callback): void
{
    global $passed;
    $callback();
    $passed++;
    echo 'PASS ' . $name . PHP_EOL;
}

$root = dirname(__DIR__) . '/docs';

test('docs root resolves', static function () use ($root): void {
    expect(
        realpath($root) === developer_docs_root(),
        'docs root did not resolve'
    );
});

foreach ([
    '',
    '../index.html',
    './hamburger-menu.html',
    '/hamburger-menu.html',
    '.htaccess',
    'nested/../hamburger-menu.html',
    "bad\0path",
    'bad\\path',
] as $invalid) {
    test(
        'reject invalid docs path ' . json_encode($invalid),
        static fn() =>
            expect(
                developer_docs_relative_path($invalid) === null,
                'invalid path was accepted'
            )
    );
}

test('accept normal docs path', static function (): void {
    expect(
        developer_docs_relative_path('hamburger-menu.html') ===
            'hamburger-menu.html'
    );
});

test('resolve protected html doc', static function () use ($root): void {
    $path = developer_docs_resolve_file(
        $root,
        'hamburger-menu.html'
    );

    expect(
        is_string($path) &&
        basename($path) === 'hamburger-menu.html'
    );
});

test('reject missing docs file', static function () use ($root): void {
    expect(
        developer_docs_resolve_file(
            $root,
            'missing.html'
        ) === null
    );
});

test('docs listing omits dotfiles', static function () use ($root): void {
    $paths = array_column(
        developer_docs_list($root),
        'path'
    );

    expect(
        in_array(
            'hamburger-menu.html',
            $paths,
            true
        )
    );

    expect(
        !in_array(
            '.htaccess',
            $paths,
            true
        )
    );
});

test('content types', static function (): void {
    expect(
        developer_docs_content_type('guide.html') ===
            'text/html; charset=utf-8'
    );

    expect(
        developer_docs_content_type('guide.md') ===
            'text/markdown; charset=utf-8'
    );

    expect(
        developer_docs_content_type('image.svg') ===
            'image/svg+xml'
    );
});

$endpoint = file_get_contents(
    __DIR__ . '/../api/docs/index.php'
);

expect(is_string($endpoint));

test('endpoint requires developer permission', static function () use ($endpoint): void {
    expect(
        str_contains(
            $endpoint,
            'PERMISSION_DEVELOPER_PREVIEW'
        ) &&
        str_contains(
            $endpoint,
            'PERMISSION_DEVELOPER'
        ) &&
        str_contains(
            $endpoint,
            'require_any_permission'
        )
    );
});

test('endpoint executes php docs through guard', static function () use ($endpoint): void {
    expect(
        str_contains(
            $endpoint,
            "\$extension === 'php'"
        ) &&
        str_contains(
            $endpoint,
            'require $file;'
        )
    );
});

echo $passed . " tests passed." . PHP_EOL;
