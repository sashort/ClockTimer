from pathlib import Path

def replace_method(text, prefix, replacement):
    i=text.find(prefix)
    if i<0:
        raise RuntimeError(f'method not found: {prefix}')
    b=text.find('{', i+len(prefix))
    if b<0:
        raise RuntimeError(f'opening brace not found: {prefix}')
    depth=0; quote=None; esc=False; line_comment=False; block=False; j=b
    while j<len(text):
        c=text[j]; n=text[j+1] if j+1<len(text) else ''
        if line_comment:
            if c=='\n': line_comment=False
        elif block:
            if c=='*' and n=='/': block=False; j+=1
        elif quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
        else:
            if c=='/' and n=='/': line_comment=True; j+=1
            elif c=='/' and n=='*': block=True; j+=1
            elif c in "'\"`": quote=c
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0:
                    return text[:i]+replacement+text[j+1:]
        j+=1
    raise RuntimeError(f'unterminated method: {prefix}')

# RingContainer: all CSS-time parsing goes through TemporalFormat.
p=Path('RingContainer.js'); s=p.read_text()
s=replace_method(s, '    static #normalizeOptionalTime(', '''    static #normalizeOptionalTime(\n        value\n    ) {\n        if (\n            value === undefined ||\n            value === null\n        ) {\n            return undefined;\n        }\n\n        const time =\n            String(value).trim();\n\n        if (\n            !time ||\n            !CSS.supports(\n                "animation-duration",\n                time\n            ) ||\n            !TemporalFormat.isCSSTime(\n                time\n            )\n        ) {\n            return undefined;\n        }\n\n        return time;\n    }''')
s=replace_method(s, '    static #timeToMilliseconds(', '''    static #timeToMilliseconds(\n        value\n    ) {\n        return (\n            TemporalFormat.cssTimeToMilliseconds(\n                String(value).trim()\n            ) ?? 0\n        );\n    }''')
p.write_text(s)

# TimeRange: delegate shared date/time and duration formatting/parsing while retaining legacy extensions.
p=Path('TimeRange.js'); s=p.read_text()
s=replace_method(s, '    #formatDateTime(', '''    #formatDateTime(\n        date\n    ) {\n        return TemporalFormat.formatDateTime(\n            date\n        );\n    }''')
s=replace_method(s, '    #uniformDate(', '''    #uniformDate(\n        timeValue,\n        lookForward = true\n    ) {\n        if (\n            timeValue === null ||\n            timeValue === undefined\n        ) {\n            return undefined;\n        }\n\n        const now =\n            new Date();\n\n        const parsed =\n            TemporalFormat.parseDateTime(\n                timeValue,\n                now\n            );\n\n        if (parsed) {\n            if (\n                lookForward &&\n                typeof timeValue === "string" &&\n                !/^[-+]?\\d+$/.test(\n                    timeValue.trim()\n                ) &&\n                !/^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}/.test(\n                    timeValue.trim()\n                ) &&\n                parsed.getTime() <\n                    now.getTime()\n            ) {\n                parsed.setDate(\n                    parsed.getDate() + 1\n                );\n            }\n\n            return parsed;\n        }\n\n        if (typeof timeValue !== "string") {\n            return undefined;\n        }\n\n        const value =\n            timeValue.trim();\n\n        const hourOnly =\n            value.match(\n                /^(\\d{1,2})\\s*(AM|PM)$/i\n            );\n\n        if (hourOnly) {\n            let hour = Number(hourOnly[1]);\n            const meridiem = hourOnly[2].toUpperCase();\n\n            if (hour < 1 || hour > 12) {\n                return undefined;\n            }\n\n            if (meridiem === "AM") {\n                if (hour === 12) hour = 0;\n            }\n            else if (hour !== 12) {\n                hour += 12;\n            }\n\n            const date = new Date(\n                now.getFullYear(),\n                now.getMonth(),\n                now.getDate(),\n                hour,\n                0,\n                0,\n                0\n            );\n\n            if (\n                lookForward &&\n                date.getTime() < now.getTime()\n            ) {\n                date.setDate(date.getDate() + 1);\n            }\n\n            return date;\n        }\n\n        if (\n            /^\\d{4}-\\d{2}-\\d{2}[T\\s]+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\.\\d{1,3})?(?:\\s*(?:AM|PM))?(?:Z|[+-]\\d{2}:?\\d{2})?$/i.test(\n                value\n            )\n        ) {\n            const date = new Date(value);\n            return Number.isNaN(date.getTime())\n                ? undefined\n                : date;\n        }\n\n        return undefined;\n    }''')
# Use TemporalFormat for canonical duration forms first; retain legacy compact seconds and permissive forms as fallback.
old='''        const normalized =\n            value\n                .trim()\n                .replace(\n                    /\\s/g,\n                    ""\n                );\n'''
new=old+'''\n        const temporalDuration =\n            TemporalFormat.parseDuration(\n                normalized\n            );\n\n        if (\n            temporalDuration !== undefined &&\n            temporalDuration > 0 &&\n            normalized.includes(\n                ":"\n            )\n        ) {\n            return temporalDuration;\n        }\n'''
if old not in s: raise RuntimeError('TimeRange duration normalization anchor not found')
s=s.replace(old,new,1)
# For >= 1 minute the shared formatter has the same canonical form. Keep sub-minute compact legacy output.
anchor='''    #formatRangeLength(\n        milliseconds\n    ) {'''
if anchor not in s: raise RuntimeError('formatRangeLength anchor missing')
insert='''    #formatRangeLength(\n        milliseconds\n    ) {\n        if (\n            Number.isInteger(milliseconds) &&\n            milliseconds >= 60000\n        ) {\n            return TemporalFormat.formatDuration(\n                milliseconds\n            );\n        }'''
# remove original opening only, leaving its validation/fallback body after our early shared return
s=s.replace(anchor,insert,1)
p.write_text(s)

# ClockTimer: centralize CSS animation times and insert time/duration parsing.
p=Path('ClockTimer.js'); s=p.read_text()
s=replace_method(s, '        #getRangeAnimationDuration(', '''        #getRangeAnimationDuration() {\n            const raw =\n                getComputedStyle(\n                    this\n                ).getPropertyValue(\n                    "--clock-timer-ring-resize-duration"\n                ).trim();\n\n            return (\n                TemporalFormat.cssTimeToMilliseconds(\n                    raw\n                ) ?? 333\n            );\n        }''')
s=replace_method(s, '        #parseInsertRangeLength(', '''        #parseInsertRangeLength(\n            value\n        ) {\n            if (typeof value !== "string") {\n                throw new TypeError(\n                    "rangeLength must be a string."\n                );\n            }\n\n            const text = value.trim();\n\n            if (\n                !/^(?:(\\d+):)?(\\d{1,2}):(\\d{2})(?:\\.(\\d{1,3}))?$/.test(\n                    text\n                )\n            ) {\n                throw new TypeError(\n                    "rangeLength must match [h:m]m:ss[.ms]."\n                );\n            }\n\n            const total =\n                TemporalFormat.durationToMilliseconds(\n                    text\n                );\n\n            if (total === undefined) {\n                throw new RangeError(\n                    "rangeLength contains an invalid duration."\n                );\n            }\n\n            if (total <= 0) {\n                throw new RangeError(\n                    "rangeLength must be greater than zero."\n                );\n            }\n\n            return total;\n        }''')
s=replace_method(s, '        #parseInsertDateTime(', '''        #parseInsertDateTime(\n            value,\n            name\n        ) {\n            if (typeof value !== "string") {\n                throw new TypeError(\n                    `${name} must be a string.`\n                );\n            }\n\n            const text = value.trim();\n\n            if (\n                !/^(?:(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})\\s+)?(\\d{1,2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?(?:\\s*(AM|PM))?$/i.test(\n                    text\n                )\n            ) {\n                throw new TypeError(\n                    `${name} must match [yyyy/mm/dd h:m]m:ss[.ms][ AM/PM].`\n                );\n            }\n\n            const date =\n                TemporalFormat.parseDateTime(\n                    text,\n                    new Date()\n                );\n\n            if (!date) {\n                throw new RangeError(\n                    `${name} contains an invalid date or time.`\n                );\n            }\n\n            return date;\n        }''')
p.write_text(s)

for fn in ['ClockTimer.js','TimeRange.js','RingContainer.js']:
    text=Path(fn).read_text()
    if 'TemporalFormat.' not in text:
        raise RuntimeError(f'{fn} was not migrated')
