from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()
start = text.index('        #runGrayscale() {')
end = text.index('        #flushAsyncOperations()', start)
block = text[start:end]

old = block
block = block.replace('this.#clockFace.style.filter', 'this.style.filter')
block = block.replace('getComputedStyle(\n                    this.#clockFace\n                ).filter', 'getComputedStyle(\n                    this\n                ).filter')
block = block.replace('this.#clockFace.animate(', 'this.animate(')

if block == old:
    raise SystemExit('No grayscale target replacements were made')

text = text[:start] + block + text[end:]
path.write_text(text)
