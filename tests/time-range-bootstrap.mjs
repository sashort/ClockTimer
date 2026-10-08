import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {compose}=createRequire(import.meta.url)('../scripts/build-pages.cjs');
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

for (const page of ['order-filler.html', 'templates/order-filler.html']) {
    const html = compose(fileURLToPath(new URL('..',import.meta.url)),readFileSync(new URL('../' + page, import.meta.url), 'utf8'));
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
        .map(match => match[1].split('?')[0]);
    assert.equal(scripts.includes('TimeRange.js'), false, page + ' loads the retired implementation');
    for (const dependency of ['StateTransactions.js', 'AsyncPersistence.js', 'TimeRangeModel.js', 'TimeRangeElement.js']) {
        assert.equal(scripts.filter(script => script === dependency).length, 1, page + ' must load ' + dependency + ' once');
        assert.ok(scripts.indexOf(dependency) < scripts.indexOf('ClockTimer.js'), page + ' must load ' + dependency + ' before ClockTimer');
    }
    assert.ok(scripts.indexOf('TimeRangeModel.js') < scripts.indexOf('TimeRangeElement.js'), page + ' must load the model before the element');
}
console.log('PASS both static and PHP templates load TimeRange dependencies before ClockTimer');
