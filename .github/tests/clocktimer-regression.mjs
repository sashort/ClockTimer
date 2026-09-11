import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.stack || e)));
page.on('console', msg => console.log(`[browser:${msg.type()}] ${msg.text()}`));

await page.setContent('<!doctype html><html><head><style>html,body{margin:0}clock-timer{display:block;width:420px;height:420px}</style></head><body></body></html>');
await page.addScriptTag({path:'RingContainer.js'});
await page.addScriptTag({path:'TimeRange.js'});
await page.addScriptTag({path:'ClockTimer.js'});

const result = await page.evaluate(async () => {
  const failures = [];
  const passes = [];
  const notes = [];
  const exercise = new Set();
  const assert = (condition, name, detail='') => {
    if (condition) passes.push(name);
    else failures.push(`${name}${detail ? ': '+detail : ''}`);
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const nowClock = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
  };
  const make = () => {
    const el = document.createElement('clock-timer');
    document.body.appendChild(el);
    return el;
  };
  const destroy = el => { try { el.remove(); } catch {} };
  const startArgs = () => ({standardTime:'01:00:00', creationTime:nowClock(), scheduledStart:nowClock(), startTime:nowClock()});
  const startTimer = el => {
    exercise.add('start');
    const r = el.start(startArgs());
    assert(r === true, 'start returns true');
    assert(el.status === 'running', 'status running after start', `got ${el.status}`);
    return r;
  };

  const C = customElements.get('clock-timer');
  const descriptors = Object.getOwnPropertyDescriptors(C.prototype);
  const publicMethods = Object.entries(descriptors)
    .filter(([n,d]) => n !== 'constructor' && typeof d.value === 'function')
    .map(([n]) => n);
  const accessors = Object.entries(descriptors)
    .filter(([n,d]) => n !== 'constructor' && (d.get || d.set))
    .map(([n,d]) => ({name:n,get:!!d.get,set:!!d.set}));
  console.log('PUBLIC_METHODS='+JSON.stringify(publicMethods));
  console.log('ACCESSORS='+JSON.stringify(accessors));

  // Lifecycle callbacks exercised by real connection/attribute/disconnection.
  {
    const el = make(); exercise.add('connectedCallback');
    assert(el.getAttribute('percent-goal') !== null, 'connectedCallback initializes attributes');
    el.setAttribute('military-time','false'); exercise.add('attributeChangedCallback');
    assert(el.getAttribute('military-time') === 'false', 'attributeChangedCallback military-time');
    destroy(el); exercise.add('disconnectedCallback');
  }

  // Accessor reads in ready state; none should throw.
  {
    const el = make();
    for (const a of accessors) if (a.get) {
      try { void el[a.name]; passes.push(`getter ${a.name}`); }
      catch (e) { failures.push(`getter ${a.name} threw: ${e}`); }
    }
    destroy(el);
  }

  // Start, editable start properties, reset, clear.
  {
    const el = make();
    startTimer(el);
    const setters = {
      standardTime:'00:45:00',
      creationTime:nowClock(),
      scheduledStart:nowClock(),
      startTime:nowClock()
    };
    for (const [name,value] of Object.entries(setters)) {
      if (descriptors[name]?.set) {
        try { el[name] = value; exercise.add(`set:${name}`); passes.push(`setter ${name}`); }
        catch (e) { failures.push(`setter ${name} threw: ${e}`); }
      }
    }
    exercise.add('reset');
    assert(el.reset() === true, 'reset succeeds after start');
    exercise.add('clear');
    assert(el.clear() === true, 'clear succeeds after start');
    assert(el.status === 'ready', 'status ready after clear', `got ${el.status}`);
    destroy(el);
  }

  // stop() no-argument contract.
  {
    const el = make(); startTimer(el); exercise.add('stop');
    let value, error;
    try { value = el.stop(); } catch (e) { error = e; }
    assert(!error, 'stop() with no arguments does not throw', error ? String(error) : '');
    assert(el.status === 'stopped', 'status stopped after stop()', `got ${el.status}`);
    notes.push(`stop() return type=${typeof value}, value=${String(value)}`);
    destroy(el);
  }

  // Closed insert.
  {
    const el = make(); startTimer(el); exercise.add('insert');
    let r, error;
    try { r = el.insert({type:'break', rangeLength:'00:01:00'}); } catch(e){ error=e; }
    assert(!error, 'closed insert does not throw', error ? String(error) : '');
    assert(r instanceof Element, 'closed insert returns element');
    destroy(el);
  }

  // Open insert + closeOpenRange.
  {
    const el = make(); startTimer(el); exercise.add('insert');
    let error;
    try { el.insert({type:'break'}); await wait(30); } catch(e){ error=e; }
    assert(!error, 'open insert does not throw', error ? String(error) : '');
    assert(el.status === 'open', 'status open during open insert', `got ${el.status}`);
    exercise.add('closeOpenRange');
    let closed;
    try { closed = el.closeOpenRange(); } catch(e){ error=e; }
    assert(!error, 'closeOpenRange(insert) does not throw', error ? String(error) : '');
    assert(closed === true, 'closeOpenRange(insert) returns true');
    assert(el.status === 'running', 'timer keeps running after closeOpenRange(insert)', `got ${el.status}`);
    destroy(el);
  }

  // Closed overwrite.
  {
    const el = make(); startTimer(el); exercise.add('overwrite');
    let r, error;
    try { r = el.overwrite({type:'break', rangeLength:'00:01:00'}); } catch(e){ error=e; }
    assert(!error, 'closed overwrite does not throw', error ? String(error) : '');
    assert(r instanceof Element, 'closed overwrite returns element');
    destroy(el);
  }

  // Open overwrite + closeOpenRange.
  {
    const el = make(); startTimer(el); exercise.add('overwrite');
    let error;
    try { el.overwrite({type:'break'}); await wait(30); } catch(e){ error=e; }
    assert(!error, 'open overwrite does not throw', error ? String(error) : '');
    assert(el.status === 'open', 'status open during open overwrite', `got ${el.status}`);
    exercise.add('closeOpenRange');
    let closed;
    try { closed = el.closeOpenRange(); } catch(e){ error=e; }
    assert(!error, 'closeOpenRange(overwrite) does not throw', error ? String(error) : '');
    assert(closed === true, 'closeOpenRange(overwrite) returns true');
    assert(el.status === 'running', 'timer keeps running after closeOpenRange(overwrite)', `got ${el.status}`);
    destroy(el);
  }

  // Replacement functions: call each in a valid started state and assert no exception.
  for (const [name,args] of [
    ['replaceWithNext',[]], ['replaceToNext',['break']],
    ['replaceWithPrevious',[]], ['replaceToPrevious',['break']]
  ]) {
    const el = make(); startTimer(el); exercise.add(name);
    try { el[name](...args); passes.push(`${name} smoke`); }
    catch(e){ failures.push(`${name} threw: ${e}`); }
    destroy(el);
  }

  // suspend/resume and queued operation behavior.
  {
    const el = make(); exercise.add('suspendUpdate'); exercise.add('resumeUpdate');
    assert(el.suspendUpdate() === el, 'suspendUpdate returns this');
    el.start(startArgs()); exercise.add('start');
    assert(el.resumeUpdate() === el, 'resumeUpdate returns this');
    await wait(50);
    assert(['running','stopped','open'].includes(el.status), 'queued start flushes without corrupt status', `got ${el.status}`);
    destroy(el);
  }

  // spin valid + invalid validation.
  {
    const el = make(); exercise.add('spin');
    try { assert(el.spin({rotations:1,duration:'10ms',scaleSpeed:'1ms',spinScaleFactor:0.95}) === el, 'spin valid returns this'); }
    catch(e){ failures.push(`spin valid threw: ${e}`); }
    let threw = false;
    try { el.spin({rotations:0}); } catch { threw = true; }
    assert(threw, 'spin rejects zero rotations');
    destroy(el);
  }

  // Attribute-driven public behavior.
  {
    const el = make();
    for (const [name,value] of [
      ['percent-goal','80%'], ['military-time','false'], ['format','h:mm A/P'],
      ['visible-hours','12,3,6,9'], ['tick-marks','12'], ['indicator-symbol','•'],
      ['grayscale','50%'], ['grayscale-ramp','10ms']
    ]) {
      try { el.setAttribute(name,value); passes.push(`attribute ${name}`); }
      catch(e){ failures.push(`attribute ${name} threw: ${e}`); }
    }
    destroy(el);
  }

  // Every public method discovered on prototype must have been exercised.
  const callbackNames = new Set(['connectedCallback','disconnectedCallback','attributeChangedCallback']);
  const unexercised = publicMethods.filter(n => !exercise.has(n) && !callbackNames.has(n));
  assert(unexercised.length === 0, 'all public methods exercised', JSON.stringify(unexercised));

  return {passes, failures, notes, publicMethods, accessors, exercised:[...exercise].sort(), unexercised};
});

console.log('RESULT='+JSON.stringify(result,null,2));
if (pageErrors.length) console.log('PAGE_ERRORS='+JSON.stringify(pageErrors,null,2));
await browser.close();

if (pageErrors.length || result.failures.length) process.exit(1);
