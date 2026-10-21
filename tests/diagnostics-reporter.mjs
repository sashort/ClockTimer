import assert from 'node:assert/strict';
import http from 'node:http';
import reporter from './diagnostics-reporter.cjs';
assert.equal(reporter.identity('duration','en-US'),'duration-en-us.log');
assert.equal(reporter.identity('time','es-MX'),'time-es-mx.log');
assert.throws(()=>reporter.identity('time','../en-US'));
assert.throws(()=>new reporter.DiagnosticsClient('http://example.com/'));
const calls=[];
const server=http.createServer(async(req,res)=>{
 let raw='';for await(const piece of req)raw+=piece;
 calls.push({method:req.method,query:new URL(req.url,'http://localhost').searchParams.get('access_token'),authorization:req.headers.authorization,cookie:req.headers.cookie,csrf:req.headers['x-csrf-token'],input:raw?JSON.parse(raw):undefined});
 res.setHeader('Content-Type','application/json');
 if(req.method==='GET'){res.setHeader('Set-Cookie','diagnostic=test-session; HttpOnly; SameSite=Lax');res.end(JSON.stringify({csrfToken:'csrf-fixture'}));}
 else {assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,'diagnostic=test-session');assert.equal(req.headers['x-csrf-token'],'csrf-fixture');res.end(JSON.stringify({state:{runId:'fixture-run'}}));}
});
try {
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=new reporter.DiagnosticsClient('http://127.0.0.1:'+server.address().port+'/',{token:'single-use-fixture'});
 await client.request({suite:'order-filler',locale:'en-US'},true);
 await client.request({action:'start',suite:'order-filler',locale:'en-US'});
 await client.request({action:'append',runId:'fixture-run',tests:[{label:'press: Ready',status:'passed'}]});
 assert.equal(calls[0].query,'single-use-fixture');
 assert.equal(calls[0].authorization,undefined);
 assert.equal(calls[1].query,null,'query token is only used for the exchange');
 assert.equal(client.token,undefined,'one-use credential is discarded after exchange');
 assert.equal(calls[2].input.tests[0].label,'press: Ready');
 console.log('PASS locale filenames and one-use diagnostics authentication followed by cookie/CSRF writes');
}finally{await new Promise(resolve=>server.close(resolve));}
