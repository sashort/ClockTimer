<?php
declare(strict_types=1);

final class LanguageTemplate
{
    private array $pack;
    private string $locale;

    public function __construct(private string $root, mixed $requestedLanguage = null)
    {
        $languageRoot = realpath($root . '/lang');
        $candidate = is_string($requestedLanguage) && preg_match('/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/D', $requestedLanguage)
            ? realpath($root . '/lang/' . $requestedLanguage) : false;
        $folder = $candidate !== false && $languageRoot !== false
            && str_starts_with($candidate, $languageRoot . DIRECTORY_SEPARATOR) && is_dir($candidate)
            ? $candidate : $root . '/lang/en-US';
        foreach (['ui-text', 'speech-patterns', 'announcements', 'associations'] as $name) {
            if (!is_file($folder . '/' . $name . '.json')) {
                $folder = $root . '/lang/en-US';
                break;
            }
        }
        $this->locale = basename($folder);
        foreach (['ui-text', 'speech-patterns', 'announcements', 'associations'] as $name) {
            $contents = file_get_contents($folder . '/' . $name . '.json');
            if ($contents === false) throw new RuntimeException('Language resource could not be read.');
            $data = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
            if (($data['version'] ?? null) !== 1 || ($data['locale'] ?? null) !== $this->locale) {
                throw new RuntimeException('Language resource has an incompatible schema or locale.');
            }
            $this->pack[$name] = $data;
        }
    }

    public function locale(): string { return $this->locale; }
    public function pack(): array { return $this->pack; }
    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
    private function text(string $id): string
    {
        $text = $this->pack['ui-text']['texts'][$id]['text'] ?? null;
        if (!is_string($text)) throw new RuntimeException('Unknown UI text ID: ' . $id);
        return self::escape($text);
    }
    private function speech(string $elementId): string
    {
        $association = $this->pack['associations']['elements'][$elementId] ?? null;
        if (!$association) throw new RuntimeException('Unknown speech element: ' . $elementId);
        $attributes = [];
        if (isset($association['patternId'])) {
            $pattern = $this->pack['speech-patterns']['patterns'][$association['patternId']] ?? null;
            if (!$pattern) throw new RuntimeException('Unknown speech pattern ID.');
            $attributes['data-speech-pattern-id'] = $pattern['id'];
            $attributes['speech-pattern'] = $pattern['pattern'];
            if (isset($pattern['noun'])) $attributes['speech-noun'] = $pattern['noun'];
        }
        if (isset($association['preprocessorId'])) {
            $rule = $this->pack['speech-patterns']['preprocessors'][$association['preprocessorId']] ?? null;
            if (!$rule) throw new RuntimeException('Unknown preprocessing rule ID.');
            $attributes['data-speech-preproc-id'] = $rule['id'];
            foreach (['handler' => 'speech-preproc', 'context' => 'speech-preproc-context', 'field' => 'speech-preproc-field'] as $key => $attribute) {
                if (($rule[$key] ?? '') !== '') $attributes[$attribute] = $rule[$key];
            }
        }
        return implode(' ', array_map(static fn($key) => $key . '="' . self::escape((string)$attributes[$key]) . '"', array_keys($attributes)));
    }
    private function options(string $elementId): string
    {
        $options = $this->pack['associations']['selects'][$elementId] ?? null;
        if (!is_array($options)) throw new RuntimeException('Unknown select association.');
        $result = '';
        foreach ($options as $option) {
            $result .= '<option value="' . self::escape((string)$option['value']) . '" data-language-id="' . self::escape($option['elementId']) . '"';
            foreach (['selected', 'disabled', 'hidden'] as $attribute) if (!empty($option[$attribute])) $result .= ' ' . $attribute;
            $result .= '>' . $this->text($option['textId']) . '</option>';
        }
        return $result;
    }
    private function rules(): string
    {
        $scripts = [];
        $folder = realpath($this->root . '/lang/' . $this->locale);
        foreach ($this->pack['speech-patterns']['customRules'] ?? [] as $rule) {
            if (!isset($rule['implementation'])) {
                if (($rule['kind'] ?? null) === 'replace') continue;
                throw new RuntimeException('Unsupported language rule.');
            }
            $relative = $rule['implementation'];
            $path = is_string($relative) ? realpath($this->root . '/' . $relative) : false;
            if ($path === false || !str_starts_with($path, $folder . DIRECTORY_SEPARATOR) || pathinfo($path, PATHINFO_EXTENSION) !== 'js') {
                throw new RuntimeException('Invalid language rule implementation.');
            }
            $scripts[] = '<script src="' . self::escape($relative) . '"></script>';
        }
        return implode("\n    ", $scripts);
    }
    public function render(string $template): string
    {
        return preg_replace_callback('/\{\{(locale|language-pack|language-rules|text|speech|options)(?::([a-f0-9-]+))?(?::([A-Za-z0-9_-]+))?\}\}/', function(array $match): string {
            $kind = $match[1];
            if ($kind === 'locale') return self::escape($this->locale);
            if ($kind === 'language-rules') return $this->rules();
            if ($kind === 'language-pack') {
                $json = json_encode($this->pack, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
                return '<script type="application/json" id="language-pack">' . $json . '</script>';
            }
            $id = $match[2] ?? '';
            if ($kind === 'speech') return $this->speech($id);
            if ($kind === 'options') return $this->options($id);
            $slot = $match[3] ?? '';
            $association = $this->pack['associations']['elements'][$id] ?? [];
            return $this->text($association['texts'][$slot] ?? $association['attributes'][$slot] ?? '');
        }, $template) ?? throw new RuntimeException('Language template rendering failed.');
    }
}
