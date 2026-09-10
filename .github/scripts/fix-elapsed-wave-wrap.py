from pathlib import Path

p = Path('TimeRange.js')
s = p.read_text()

old = '''        this.#elapsedWaveLayer.style.backgroundImage =\n            `conic-gradient(from 0deg at 50% 50%, ` +\n            `${rgba(strength)} 0deg, ` +\n            `${rgba(shoulder)} var(--elapsed-wave-shoulder, 4deg), ` +\n            `transparent var(--elapsed-wave-width, 12deg), ` +\n            `transparent calc(360deg - var(--elapsed-wave-width, 12deg)), ` +\n            `${rgba(shoulder)} calc(360deg - var(--elapsed-wave-shoulder, 4deg)), ` +\n            `${rgba(strength)} 360deg)`;'''
new = '''        this.#elapsedWaveLayer.style.backgroundImage =\n            `conic-gradient(from 0deg at 50% 50%, ` +\n            `transparent 0deg, ` +\n            `transparent calc(180deg - var(--elapsed-wave-width, 12deg)), ` +\n            `${rgba(shoulder)} calc(180deg - var(--elapsed-wave-shoulder, 4deg)), ` +\n            `${rgba(strength)} 180deg, ` +\n            `${rgba(shoulder)} calc(180deg + var(--elapsed-wave-shoulder, 4deg)), ` +\n            `transparent calc(180deg + var(--elapsed-wave-width, 12deg)), ` +\n            `transparent 360deg)`;'''
if old not in s:
    raise SystemExit('wave gradient anchor not found')
s = s.replace(old, new, 1)

s = s.replace(
    '''                    `${-waveWidth}deg`''',
    '''                    `${-waveWidth - 180}deg`''',
    1
)
s = s.replace(
    '''                    `${360 + waveWidth}deg`''',
    '''                    `${360 + waveWidth - 180}deg`''',
    1
)
s = s.replace(
    '''                `${startAngle - waveWidth}deg`''',
    '''                `${startAngle - waveWidth - 180}deg`''',
    1
)
s = s.replace(
    '''                `${sweepEndAngle + waveWidth}deg`''',
    '''                `${sweepEndAngle + waveWidth - 180}deg`''',
    1
)

p.write_text(s)
