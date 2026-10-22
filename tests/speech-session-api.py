"""Real PHP endpoint and browser-session admission; no database writes/audio."""
import http.cookiejar
import json
import os
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[1]
with socket.socket() as free:
    free.bind(('127.0.0.1',0))
    port=free.getsockname()[1]
origin='http://127.0.0.1:'+str(port)
with tempfile.TemporaryDirectory(prefix='clocktimer-speech-api-') as directory:
    state=Path(directory)
    config=state/'config.json'
    config.write_text(json.dumps({'secret':'a'*64,'origins':[origin],'models':{'en-US':'english','fr-FR':'french'}}))
    env=dict(os.environ,CLOCKTIMER_SPEECH_CONFIG=str(config),CLOCKTIMER_SPEECH_TICKET_DIR=str(state))
    process=subprocess.Popen([os.environ.get('CLOCKTIMER_PHP','php'),'-S','127.0.0.1:'+str(port),'-t',str(root)],
                             env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        endpoint=origin+'/api/speech/session/'
        def request(body=None,csrf=None,source=origin):
            headers={'Origin':source}
            if csrf:headers['X-CSRF-Token']=csrf
            if body is not None:headers['Content-Type']='application/json'
            req=urllib.request.Request(endpoint,data=None if body is None else json.dumps(body).encode(),headers=headers)
            try:
                with client.open(req,timeout=3) as response:return response.status,json.load(response)
            except urllib.error.HTTPError as error:return error.code,json.load(error)
        for attempt in range(50):
            try:status,info=request();break
            except urllib.error.URLError:time.sleep(.1)
        else:raise AssertionError('PHP API did not start')
        assert status==200,(status,info)
        assert info['languages']==['en-US','fr-FR']
        assert request({'language':'en-US'})[0]==403
        csrf=info['csrfToken']
        assert request({'language':'en-US'},csrf,'https://evil.example')[0]==403
        assert request({},csrf)[0]==422
        assert request({'language':'de-DE'},csrf)[1]['error']=='unsupported_language'
        status,grant=request({'language':'EN-us'},csrf)
        assert grant['authenticated'] is False
        assert status==200 and grant['language']=='en-US' and grant['websocketPath']=='/speech-ws'
        status,french=request({'language':'fr-FR'},csrf)
        assert status==200 and french['language']=='fr-FR'
        status,forged=request({'language':'en-US','authenticated':True},csrf)
        assert status==200 and forged['authenticated'] is False,'Client cannot request authenticated authority'
        assert request({'language':'en-US','oversized':'x'*1024},csrf)[0]==413
        # Rate admission is shared across anonymous cookie sessions on an IP.
        for i in range(17):assert request({'language':'en-US'},csrf)[0]==200
        assert request({'language':'en-US'},csrf)[0]==429
        print('PASS real PHP speech API: pre-login session, CSRF/origin, canonical locale, unknown locale, body limit and per-IP admission')
    finally:
        process.terminate()
        process.wait(timeout=5)
