from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''                    --clock-timer-tick-color:\n                        currentColor;'''
new='''                    --clock-timer-tick-color:\n                        currentColor;\n\n                    --clock-timer-tick-shadow:\n                        0 0 1px rgb(0 0 0 / 75%),\n                        0 0 2px rgb(0 0 0 / 45%);'''
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
old2='''                    background:\n                        var(\n                            --clock-timer-tick-color\n                        );'''
new2='''                    background:\n                        var(\n                            --clock-timer-tick-color\n                        );\n\n                    box-shadow:\n                        var(\n                            --clock-timer-tick-shadow\n                        );'''
assert s.count(old2)==1, s.count(old2)
s=s.replace(old2,new2,1)
p.write_text(s)
