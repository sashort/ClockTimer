from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''                                item.end > item.start &&\n                                item.start >= end\n                        )\n                        .sort(\n                            (a, b) =>\n                                a.start - b.start ||\n                                a.end - b.end\n                        )[0];'''
new='''                                item.end > item.start &&\n                                item.start === end\n                        )[0];'''
assert old in s
s=s.replace(old,new,1)
p.write_text(s)
