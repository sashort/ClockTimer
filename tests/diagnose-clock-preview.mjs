import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const css = fs.readFileSync(path.join(root, 'app.css'), 'utf8');

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:900}});

try {
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>
    <dialog id="graphicalSettingsDialog" class="app-dialog settings-dialog graphical-dialog">
      <form id="graphicalSettingsForm" method="dialog">
        <header class="dialog-header"><h2>Clock/Timer Settings</h2></header>
        <div class="dialog-actions three-actions graphical-settings-actions"><button>Reset</button><button>Cancel</button><button>Save</button></div>
        <div class="settings-grid graphical-settings-grid">
          <div class="settings-groups">
            <details class="settings-category"><summary>Timer Settings</summary><div class="settings-category-content">Settings</div></details>
            <details class="settings-category"><summary>Clock Font and Color</summary><div class="settings-category-content">Settings</div></details>
          </div>
          <aside class="clock-preview" aria-label="Clock preview">
            <clock-timer id="clockPreview" military-time="true" time-format="HHmm"
              visible-hours="12,3,6,9" tick-marks="[10]" indicator-symbol="▲"></clock-timer>
          </aside>
        </div>
      </form>
    </dialog>
  </body></html>`);

  for (const file of ['TemporalFormat.js','RingContainer.js','TimeRange.js','ClockTimer.js']) {
    await page.addScriptTag({path:path.join(root,file)});
  }

  await page.evaluate(() => {
    const preview = document.querySelector('#clockPreview');
    preview.keepAspectRatio = false;
    const dialog = document.querySelector('#graphicalSettingsDialog');
    dialog.showModal();

    preview.style.setProperty('--clock-timer-trip-color','#0053e2');
    preview.style.setProperty('--clock-timer-early-start-color','#4dbdf5');
    preview.style.setProperty('--clock-timer-break-color','#001e60');
    preview.style.setProperty('--clock-timer-lunch-color','#ffc220');
    preview.style.setProperty('--clock-timer-break-buffer-color','#6b7f99');
    preview.style.setProperty('--clock-timer-down-color','#5f6772');
    preview.style.setProperty('--clock-timer-approval-surplus-color','#9c6b30');
    preview.style.setProperty('--clock-timer-approval-deficit-color','#7a1f3d');
    preview.style.setProperty('--clock-timer-tolerance-color','#2e7d32');
    preview.style.setProperty('--clock-timer-overtime-color','#ff5c5c');
    preview.style.setProperty('--clock-timer-latency-color','#e1251b');
    preview.style.setProperty('--clock-timer-hour-hand-length','28%');
    preview.style.setProperty('--clock-timer-hour-hand-color','#ffffff');
    preview.style.setProperty('--clock-timer-minute-hand-length','38%');
    preview.style.setProperty('--clock-timer-minute-hand-color','#ffffff');
    preview.style.setProperty('--clock-timer-second-hand-length','42%');
    preview.style.setProperty('--clock-timer-second-hand-color','#ffc220');
    preview.style.setProperty('--clock-timer-hour-font','Helvetica, Arial, sans-serif');
    preview.style.setProperty('--clock-timer-time-font','Helvetica, Arial, sans-serif');
    preview.style.setProperty('--clock-timer-time-color','#ffffff');
    preview.style.setProperty('--clock-timer-tick-color','#ffffff');
    preview.style.color='#ffffff';

    const ring = document.createElement('ring-container');
    ring.dataset.settingsPreview='ranges';
    ring.clockTimerRing=0;
    ring.clockTimerRingIndex=0;
    ring.clockTimerExternalRangeLayout=false;
    ring.setAttribute('width','18px');
    ring.setAttribute('inset','18px');

    const fmt = value => {
      const pad=(part,len=2)=>String(part).padStart(len,'0');
      return `${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(),3)}`;
    };

    let cursor = new Date();
    cursor.setSeconds(0,0);
    cursor = new Date(cursor.getTime()-45*60*1000);
    for (const [type,minutes] of [['trip',5],['earlystart',10],['break',10],['buffer',10],['lunch',15],['down',10],['approval-surplus',5],['approval-deficit',5],['overtime',5],['tolerance',5],['latency',10]]) {
      const end = new Date(cursor.getTime()+minutes*60*1000);
      const range = document.createElement('time-range');
      range.setAttribute('type',type);
      range.setAttribute('start-time',fmt(cursor));
      range.setAttribute('end-time',fmt(end));
      ring.append(range);
      cursor=end;
    }
    preview.prepend(ring);
    preview.refreshLayout();
  });

  await page.waitForTimeout(1000);

  const state = await page.evaluate(() => {
    const preview=document.querySelector('#clockPreview');
    const parent=preview.closest('.clock-preview');
    const grid=preview.closest('.graphical-settings-grid');
    const form=preview.closest('#graphicalSettingsForm');
    const dialog=preview.closest('#graphicalSettingsDialog');
    const rect=preview.getBoundingClientRect();
    const parentRect=parent.getBoundingClientRect();
    const gridRect=grid.getBoundingClientRect();
    const formRect=form.getBoundingClientRect();
    const dialogRect=dialog.getBoundingClientRect();
    const ps=getComputedStyle(preview);
    const pps=getComputedStyle(parent);
    const gs=getComputedStyle(grid);
    const rings=Array.from(preview.children).filter(x=>x.localName==='ring-container').map(x=>{
      const r=x.getBoundingClientRect();
      return {width:r.width,height:r.height,display:getComputedStyle(x).display,opacity:getComputedStyle(x).opacity};
    });
    return {
      rect:{width:rect.width,height:rect.height,left:rect.left,top:rect.top},
      parentRect:{width:parentRect.width,height:parentRect.height,left:parentRect.left,top:parentRect.top},
      gridRect:{width:gridRect.width,height:gridRect.height,left:gridRect.left,top:gridRect.top},
      formRect:{width:formRect.width,height:formRect.height,left:formRect.left,top:formRect.top},
      dialogRect:{width:dialogRect.width,height:dialogRect.height,left:dialogRect.left,top:dialogRect.top},
      preview:{display:ps.display,visibility:ps.visibility,opacity:ps.opacity,color:ps.color},
      parent:{display:pps.display,visibility:pps.visibility,opacity:pps.opacity,zIndex:pps.zIndex,background:pps.backgroundColor},
      grid:{overflow:gs.overflow,zIndex:gs.zIndex},
      keepAspectRatio:preview.keepAspectRatio,
      rings
    };
  });

  let painted=0;
  if (state.rect.width > 0 && state.rect.height > 0) {
    const image=PNG.sync.read(await page.locator('#clockPreview').screenshot({omitBackground:true}));
    for(let i=3;i<image.data.length;i+=4) if(image.data[i]>0) painted++;
  }

  console.log(JSON.stringify({...state,paintedPixels:painted},null,2));
  assert(state.rect.width>150 && state.rect.height>100);
  assert.equal(state.preview.display,'block');
  assert.notEqual(state.preview.visibility,'hidden');
  assert(Number(state.preview.opacity)>0);
  assert.equal(state.keepAspectRatio,false);
  assert(state.rings.length>=5);
  assert(painted>100,'actual app.css preview must paint pixels');
  console.log('PASS actual WMOF preview CSS paints rebuilt ClockTimer');
} finally {
  await browser.close();
}
