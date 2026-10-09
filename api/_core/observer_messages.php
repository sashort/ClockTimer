<?php
declare(strict_types=1);
function observer_message_text(string $template, array $user): string
{
    $fields = ['first'=>'first_name','middle'=>'middle_name','last'=>'last_name','preferred'=>'preferred_name'];
    $result = preg_replace_callback('/([\\\\]\[)|\[([^\[\]]+)\]/u', static function(array $match) use ($fields,$user): string {
        if (($match[1] ?? '') !== '') return '[';
        $tokens = preg_split('/\s+/u', strtolower(trim($match[2])));
        foreach ($tokens as $token) if (!isset($fields[$token])) return $match[0];
        $values=[];
        foreach ($tokens as $token) {
            $value=trim((string)($user[$fields[$token]] ?? ''));
            if ($token === 'preferred' && $value === '') $value=trim((string)($user['first_name'] ?? ''));
            if($value!=='')$values[]=$value;
        }
        return implode(' ', $values);
    }, $template);
    if($result===null)throw new InvalidArgumentException('Invalid message encoding.');
    return trim(preg_replace('/[ \t]{2,}/u', ' ', $result));
}
