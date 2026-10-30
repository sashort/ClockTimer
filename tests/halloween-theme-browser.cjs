const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const fixture = require('./order-filler-master-fixture.cjs');
const out = path.resolve(__dirname,'../../outputs/halloween-implemented'); fs.mkdirSync(out,{recursive:true});
(async () => {
    const f = await fixture({input:'transcript'}), p = f.page, op = require('./retained-page-operation.cjs')(p);
    const images = [], audits = [];
    p.on('pageerror',e=>console.log('theme browser error stack:',e.stack));
    let settings = {version:1,orderFiller:{'wmof.clock.theme':'default',
        'wmof.clock.graphicalSettings':JSON.stringify({tripColor:'#1234ff',overtimeColor:'#00ff00'})}}, trips = [];
    await p.route('**/api/settings/',async route => {
        if (route.request().method() === 'PATCH') {
            const b = route.request().postDataJSON(); settings = {...settings,[b.namespace]:{...settings[b.namespace],...b.changes}};
        }
        await route.fulfill({json:{userId:2,settings}});
    });
    await p.route('**/api/trips/**',route => {
        const url = new URL(route.request().url());
        return route.fulfill({json:url.searchParams.get('result')==='list' ? {trips,verbose:true} : {
            tripId:99,tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0,
            aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,countedTimeMilliseconds:0,actualTimeMilliseconds:0},nonProduction:{trips:[]}}}});
    });
    async function audit(name) {
        const inspect = () => {
            const failures = [];
            const walk = root => {
                for (const e of root.querySelectorAll('*')) {
                    const shadow = e.shadowRoot || globalThis.testShadows?.get(e); if (shadow) walk(shadow);
                    if (e.matches('style,script,link,meta,defs,defs *') || !e.getBoundingClientRect().width || !e.getBoundingClientRect().height) continue;
                    const c = getComputedStyle(e);
                    if (c.visibility === 'hidden' || c.display === 'none') continue;
                    for (const key of ['color','backgroundColor','backgroundImage','borderTopColor','fill','stroke','stopColor']) {
                        const value = c[key] || '';
                        for (const match of value.matchAll(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/g)) {
                            const [,r,g,b,alpha] = match.map(Number);
                            if (alpha === 0) continue;
                            if (b > r+25 && b > g*1.1 && r < g*1.2)
                                failures.push({tag:e.localName,id:e.id,class:e.className?.baseVal||e.className,key,value});
                        }
                    }
                }
            }; walk(document); return failures.slice(0,35);
        };
        const blue = (await Promise.all(p.frames().filter(frame=>frame.url()!=='about:blank').map(frame=>frame.evaluate(inspect)))).flat();
        audits.push({name,blue});
    }
    async function shot(name) {
        console.log('theme capture:',name); await p.waitForTimeout(450); await audit(name);
        await p.screenshot({path:path.join(out,name+'.png')}); images.push(name);
    }
    try {
        await p.evaluate(() => WMOFSeasonalTheme.setPreference('halloween',{persist:false}));
        await shot('login');
        await op(async () => {
            await clockTimer.connect('test','test'); document.querySelector('#loginDialog').close();
            while(!WMOFAccountSettings.loaded) await new Promise(r=>setTimeout(r,20));
        });
        const saved = settings.orderFiller['wmof.clock.graphicalSettings'];
        const original = await p.evaluate(() => getComputedStyle(document.querySelector('.app')).backgroundImage);
        await p.locator('#menuButton').click(); await p.locator('#settingsMenuButton').click();
        await p.locator('#themesMenuButton').click(); await p.locator('label.halloween-theme-option').click();
        await p.waitForFunction(() => WMOFSeasonalTheme.active && !document.querySelector('#halloweenThemeToggle').disabled);
        assert.equal(settings.orderFiller['wmof.clock.theme'],'halloween');
        await shot('themes-menu');
        assert.equal(await p.evaluate(() => WMOFHalloweenAudio.isActive()),true,'same switch controls sounds');
        await p.locator('label.halloween-theme-option').click();
        await p.waitForFunction(() => !WMOFSeasonalTheme.active && !document.querySelector('#halloweenThemeToggle').disabled);
        assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.app')).backgroundImage),original,'normal palette restores immediately');
        assert.equal(await p.evaluate(() => WMOFHalloweenAudio.isActive()),false,'normal sounds restore');
        assert.equal(settings.orderFiller['wmof.clock.graphicalSettings'],saved,'theme never rewrites saved clock colors');
        assert.equal(await p.evaluate(() => testShadows.get(document.querySelector('#clockTimer')).querySelector('.halloween-pumpkin').style.display),'none');
        await p.locator('label.halloween-theme-option').click();
        await p.waitForFunction(() => WMOFSeasonalTheme.active && !document.querySelector('#halloweenThemeToggle').disabled);
        await p.evaluate(() => document.querySelector('#mainMenu').hidePopover());
        await op(async () => {
            clockTimer.configure({goal_type:'auto',trip_goal:'120%',total_goal:'120%',auto_goal:false});
            document.querySelector('#percentageDisplayBar').click();document.querySelector('#actionDisplayCompact').click();
            await WMOFLayoutMotion.whenSettled();await clockTimer.start({standardTime:'0:30:00'});
        });
        await p.clock.fastForward(20*60000);await shot('compact-bar');
        assert(await p.locator('.goal-bar-avatar.is-skeleton .halloween-skull').count(),'actual avatar becomes a skeleton');
        const skin = await p.evaluate(() => ({trip:getComputedStyle(clockTimer).getPropertyValue('--clock-timer-trip-color').trim(),
            overtime:getComputedStyle(clockTimer).getPropertyValue('--clock-timer-overtime-color').trim()}));
        assert.deepEqual(skin,{trip:'#ef8b21',overtime:'#ff6328'},'seasonal timer colors override custom colors without saving them');
        await op(async()=>{document.querySelector('#actionDisplayFull').click();document.querySelector('#percentageDisplayClassic').click();await WMOFLayoutMotion.whenSettled();});
        await shot('full-classic');
        await op(async()=>{document.querySelector('#actionDisplayCompact').click();document.querySelector('#percentageDisplayBar').click();await WMOFLayoutMotion.whenSettled();});
        await op(()=>WMOFActions.openGoalEditor({scope:'total'}));await p.waitForSelector('#numberPadDialog[open]');await shot('goal-numberpad');
        await op(()=>WMOFActions.switchNumberPadToVoice());await p.waitForSelector('#voiceEntrySurface[open]');await shot('voicepad');
        await p.locator('#voiceEntryTouch').click();await p.waitForSelector('#numberPadDialog[open]');await p.locator('#numberPadCancel').click();
        await p.waitForFunction(()=>!document.querySelector('#numberPadDialog').open);
        const date = await p.evaluate(()=>new Date().toISOString().slice(0,10));
        trips = [{id:41,startTime:date+'T10:00:00Z',endTime:date+'T10:27:00Z',standardTimeMilliseconds:1800000,
            actualTimeMilliseconds:1620000,countedTimeMilliseconds:1620000,running:false,events:[
                {id:1,event:'trip.started',timestamp:date+'T10:00:00Z',value:{standardTimeMilliseconds:1800000}},
                {id:2,event:'trip.stopped',timestamp:date+'T10:27:00Z',value:{}}]}];
        trips.push({id:42,startTime:date+'T09:00:00Z',endTime:date+'T09:15:00Z',breakOnly:true,nonProduction:false,standardTimeMilliseconds:null,countedTimeMilliseconds:0,actualTimeMilliseconds:900000,running:false,events:[{event:'trip.started',timestamp:date+'T09:00:00Z',value:{breakOnly:true}}]});
        await op(()=>WMOFActions.openTripLog('pointer'));await p.waitForSelector('.trip-log-trip',{state:'attached'});
        const breakContrast=await p.locator('.trip-log-trip.is-break-only').evaluate(e=>{
            const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
            const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
            const row=getComputedStyle(e),badge=getComputedStyle(e.querySelector('.trip-log-break-only-badge'));return{row:ratio(row.color,row.backgroundColor),badge:ratio(badge.color,badge.backgroundColor)};
        });assert(breakContrast.row>=4.5&&breakContrast.badge>=4.5,'standalone-break row and badge contrast: '+JSON.stringify(breakContrast));
        await p.locator('.trip-log-trip').first().evaluate(e=>{for(let a=e;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;});
        await shot('trip-log');
        await p.route('**/api/trip-editor/**',r=>r.fulfill({json:{revision:'theme-test',events:trips[0].events}}));
        await p.locator('.trip-log-percent-button').first().click();
        await p.waitForSelector('#numberPadDialog[open]'); await shot('official-percent');
        await p.locator('#numberPadCancel').click(); await p.waitForFunction(()=>!document.querySelector('#numberPadDialog').open);
        await op(()=>WMOFActions.closeTripLog('pointer'));
        await p.locator('#menuButton').click();await p.locator('#settingsMenuButton').click();
        await p.locator('#openGraphicalSettingsFrame').click();await p.waitForSelector('#clockTimerSettingsFrameDialog[open]');
        await p.waitForTimeout(1000);await shot('clock-settings');
        const frame = p.frames().find(frame=>frame.url().includes('graphical-settings'));
        if(frame) assert.equal(await frame.evaluate(()=>WMOFSeasonalTheme.active),true,'embedded settings follow the same theme');
        await p.evaluate(()=>document.querySelector('#clockTimerSettingsFrameDialog').close()); await p.waitForTimeout(450);
        await p.evaluate(()=>document.querySelector('#audioSettingsButton').click());
        await p.waitForSelector('#clockTimerSettingsFrameDialog[open]'); await p.waitForTimeout(900); await shot('audio-settings');
        const audioFrame = p.frames().find(frame=>frame.url().includes('settings.html'));
        assert(await audioFrame.evaluate(()=>document.querySelector('#audioSettingsDialog').getBoundingClientRect().height>innerHeight-30),'audio settings fills its iframe instead of collapsing to a strip');
        assert.equal(await audioFrame.evaluate(()=>getComputedStyle(document.querySelector('#settingsPageHeader')).display),'none','embedded settings hides its standalone header');
        assert(await p.evaluate(()=>document.querySelector('#clockTimerSettingsFrame').getBoundingClientRect().bottom<=testShadows.get(document.querySelector('#speechMicBar')).querySelector('#bar').getBoundingClientRect().top),'settings footer stays above the Mic Bar');
        await p.evaluate(()=>document.querySelector('#clockTimerSettingsFrameDialog').close()); await p.waitForTimeout(450);
        for(const [id,name] of [['tripSettingsDialog','trip-settings'],['breakDialog','break-selector'],['profileDialog','profile'],['stateSettingsDialog','trip-preferences'],['cancelDownConfirmDialog','confirmation']]){
            await p.evaluate(id=>document.getElementById(id).showModal(),id); await shot(name);
            await p.evaluate(id=>document.getElementById(id).close(),id);
        }
        async function layouts(suffix){
            for(const [n,actions,percent] of [[1,'Full','Classic'],[2,'Full','Bar'],[3,'Compact','Classic'],[4,'Compact','Bar']]){
                await op(async({actions,percent})=>{document.querySelector('#actionDisplay'+actions).click();document.querySelector('#percentageDisplay'+percent).click();await WMOFLayoutMotion.whenSettled();},{actions,percent});
                await shot('mode-'+n+suffix);
                if(suffix==='d'){
                    const colors=await p.evaluate(()=>({buttons:['downBreakButton','downCancelButton'].map(id=>{const s=getComputedStyle(document.getElementById(id));return{color:s.color,background:s.backgroundImage};}),timer:{color:getComputedStyle(document.querySelector(app.dataset.actionDisplay==='compact'?'.compact-interval-timer':'#downElapsedValue')).color,zIndex:getComputedStyle(document.querySelector('.compact-interval-timer')).zIndex}}));
                    assert.equal(colors.buttons[0].color,'rgb(255, 215, 120)');assert.equal(colors.buttons[1].color,'rgb(255, 245, 226)');
                    for(const button of colors.buttons){const rgb=button.background.match(/rgb\((\d+), (\d+), (\d+)\)/).slice(1,4).map(Number);assert(Math.max(...rgb)-Math.min(...rgb)>30,'Down backgrounds retain seasonal color');}
                    assert.equal(colors.timer.color,'rgb(255, 215, 120)');if(actions==='Compact')assert(Number(colors.timer.zIndex)>3000,'compact Down timer stays above desaturation');
                }
            }
        }
        await layouts('a');
        await op(()=>clockTimer.startInterval('lunch',900000,{},15000,15000)); await p.clock.runFor(2500);
        await layouts('b');
        assert.equal(await p.locator('.goal-bar-avatar').getAttribute('data-pose'),'break');
        const bones=await p.locator('.goal-bar-avatar').evaluate(e=>{const h=e.querySelector('.rig-head'),s=e.querySelector('.halloween-skull');return [Number(h.getAttribute('cx')),Number(h.getAttribute('cy')),s.getAttribute('transform')];});
        assert.equal(bones[2],`translate(${bones[0]} ${bones[1]})`,'skeleton skull follows sitting geometry');
        await op(()=>clockTimer.endInterval()); await p.clock.runFor(1500);
        await op(()=>clockTimer.startInterval('down')); await p.clock.runFor(1500); await layouts('d');
        await op(()=>clockTimer.endInterval()); await p.clock.runFor(1500);
        await p.evaluate(()=>{void WMOFActions.readTripSummary();}); await shot('trip-summary');
        await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
        await op(()=>clockTimer.stop()); await p.clock.runFor(1200);
        await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
        await layouts('');
        await op(async()=>{await WMOFSeasonalTheme.setPreference(null,{persist:false});
            if(WMOFSeasonalTheme.refresh(new Date(2026,9,30)))throw Error('October 30 must remain normal');
            if(!WMOFSeasonalTheme.refresh(new Date(2026,9,31)))throw Error('October 31 activates the date default');
            if(WMOFSeasonalTheme.refresh(new Date(2026,10,1)))throw Error('November 1 restores normal');
            await WMOFAccountSettings.load(2,'a'.repeat(64));
            if(!WMOFSeasonalTheme.active)throw Error('saved account choice must restore');});
        const url=new URL('drop-in.php',p.url()).href;await p.goto(url);await p.waitForLoadState('domcontentloaded');
        await op(()=>WMOFSeasonalTheme.setPreference('halloween',{persist:false}));await p.waitForTimeout(1000);await shot('drop-in');
        assert(audits.every(a=>a.blue.length===0),'remaining blue colors: '+JSON.stringify(audits.filter(a=>a.blue.length)));
        assert.deepEqual(f.errors,[]);
        fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(audits,null,2));
        fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Implemented Halloween UI</title><style>body{margin:24px;background:#17120e;color:#ffe8bc;font:18px system-ui}main{display:flex;flex-wrap:wrap;gap:20px}img{width:320px;max-width:100%;border:1px solid #cf8a32;border-radius:12px}h2{font-size:18px}</style><h1>Halloween UI · implemented components</h1><main>'+images.map(name=>'<section><h2>'+name.replaceAll('-',' ')+'</h2><a href="'+name+'.png"><img src="'+name+'.png"></a></section>').join('')+'</main>');
        console.log(JSON.stringify({images,audits,errors:f.errors}));
    } finally {await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
