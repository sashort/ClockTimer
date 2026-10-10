<?php
declare(strict_types=1);

/** Compose the shared document and its page-specific HTML fragments. */
final class PageTemplate
{
    private const PAGES = ['index', 'order-filler', 'drop-in'];

    public static function expand(string $root, string $template): string
    {
        $folder = realpath($root . '/templates');
        $read = static function (string $name) use ($folder): string {
            if ($folder === false || !preg_match('/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.html$/D', $name)) {
                throw new RuntimeException('Invalid page sub-template.');
            }
            $path = realpath($folder . '/' . $name);
            if ($path === false || !str_starts_with($path, $folder . DIRECTORY_SEPARATOR) || !is_file($path)) {
                throw new RuntimeException('Page sub-template could not be read.');
            }
            $contents = file_get_contents($path);
            if ($contents === false) throw new RuntimeException('Page sub-template could not be read.');
            return $contents;
        };
        $expand = null;
        $expand = static function (string $html, ?string $page = null, array $stack = []) use (&$expand, $read): string {
            if (count($stack) > 16) throw new RuntimeException('Page template nesting is too deep.');
            return preg_replace_callback('/\{\{(page|include):(.+?)\}\}/s',
                static function (array $match) use ($expand, $read, $page, $stack): string {
                    if ($match[1] === 'page') {
                        if (!in_array($match[2], self::PAGES, true) || $page !== null) {
                            throw new RuntimeException('Unknown or nested page template.');
                        }
                        return $expand($read('page.html'), $match[2], ['page.html']);
                    }
                    $name = str_replace('{page}', $page ?? '', $match[2]);
                    if (in_array($name, $stack, true)) throw new RuntimeException('Cyclic page sub-template.');
                    return $expand($read($name), $page, [...$stack, $name]);
                }, $html) ?? throw new RuntimeException('Page template composition failed.');
        };
        return $expand($template);
    }
}
