from pathlib import Path

def extract(text, marker):
    i=text.find(marker)
    if i<0: return f'NOT FOUND: {marker}\n'
    b=text.find('{',i)
    if b<0: return f'NO BRACE: {marker}\n'
    depth=0; quote=None; esc=False; line_comment=False; block=False
    j=b
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
                    return text[i:j+1]+'\n'
        j+=1
    return f'UNTERMINATED: {marker}\n'

wanted={
'ClockTimer.js':['#normalizeFormat(', '#updateDisplay(', '#validateDurationTime(', '#validateClockTime(', '#formatStandardTime(', '#formatTimelineTime(', '#parseInsertDateTime(', '#parseInsertRangeLength(', '#getRangeAnimationDuration('],
'TimeRange.js':['#uniformDate(', '#formatDateTime(', '#parseRangeLength(', '#formatRangeLength('],
'RingContainer.js':['static #normalizeOptionalTime(', 'static #timeToMilliseconds(']
}
out=[]
for fn, markers in wanted.items():
    text=Path(fn).read_text()
    out.append('\n===== '+fn+' =====\n')
    for m in markers:
        out.append('\n--- '+m+' ---\n')
        out.append(extract(text,m))
Path('TEMPORAL_METHODS.txt').write_text(''.join(out))
