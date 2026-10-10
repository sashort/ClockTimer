<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/_core/sql_console.php';

$passed = 0;

function test(
    string $name,
    callable $callback
): void {
    $callback();
    $GLOBALS['passed']++;
    echo "PASS $name" . PHP_EOL;
}

function expect(bool $condition): void {
    if (!$condition) {
        throw new RuntimeException(
            'Assertion failed'
        );
    }
}

test(
    'splits ordinary statements',
    function (): void {
        $statements =
            split_sql_statements(
                "SELECT 1;\nSELECT 2;"
            );

        expect(
            count($statements) === 2 &&
            $statements[0] === 'SELECT 1' &&
            $statements[1] === 'SELECT 2'
        );
    }
);

test(
    'does not split semicolons inside strings',
    function (): void {
        $statements =
            split_sql_statements(
                "SELECT 'a;b' AS value; SELECT 2;"
            );

        expect(
            count($statements) === 2 &&
            str_contains(
                $statements[0],
                "'a;b'"
            )
        );
    }
);

test(
    'does not split semicolons inside comments',
    function (): void {
        $statements =
            split_sql_statements(
                "-- comment ; here\nSELECT 1; # another ;\nSELECT 2;"
            );

        expect(
            count($statements) === 2
        );
    }
);

test(
    'supports delimiter directives for routines',
    function (): void {
        $sql = <<<'SQL'
DELIMITER $$
CREATE PROCEDURE demo()
BEGIN
    SELECT 1;
    SELECT 2;
END$$
DELIMITER ;
SELECT 3;
SQL;

        $statements =
            split_sql_statements(
                $sql
            );

        expect(
            count($statements) === 2 &&
            str_contains(
                $statements[0],
                'SELECT 1;'
            ) &&
            str_contains(
                $statements[0],
                'SELECT 2;'
            ) &&
            $statements[1] ===
                'SELECT 3'
        );
    }
);

test(
    'supports backtick identifiers and escaped quotes',
    function (): void {
        $statements =
            split_sql_statements(
                "SELECT `semi;colon`, 'it\\'s;ok'; SELECT 2;"
            );

        expect(
            count($statements) === 2
        );
    }
);

test(
    'rejects unterminated SQL strings',
    function (): void {
        try {
            split_sql_statements(
                "SELECT 'unfinished;"
            );
        } catch (
            InvalidArgumentException
        ) {
            return;
        }

        throw new RuntimeException(
            'Expected parser rejection'
        );
    }
);

echo $passed . " tests passed." . PHP_EOL;
