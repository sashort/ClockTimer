import asyncio
import base64
import hashlib
import hmac
import importlib.util
import json
import sys
import time
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('speech_server', Path(__file__).resolve().parents[1]/'services/speech/server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
SECRET = 'a'*64
ORIGIN = 'http://127.0.0.1:9999'


def ticket(language='en-US', jti='1'*32, **overrides):
    now = int(time.time())
    grant = dict(v=1, aud='clocktimer-speech', origin=ORIGIN, language=language,
                 sub='b'*64, authenticated=False, iat=now, exp=now+60, jti=jti)
    grant.update(overrides)
    encoded = base64.urlsafe_b64encode(json.dumps(grant).encode()).decode().rstrip('=')
    return encoded+'.'+hmac.new(SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()


class FakeRecognizer:
    def __init__(self, model, rate):
        self.model = model
        self.frames = 0
        assert rate == 16000
    def SetWords(self, enabled):
        assert enabled
    def AcceptWaveform(self, pcm):
        self.frames += 1
        return False
    def PartialResult(self):
        return json.dumps({'partial':'wake' if self.frames == 1 else 'break start'})
    def FinalResult(self):
        return json.dumps({'text':'wake' if self.frames == 1 else 'break start'})
    def Reset(self):
        self.frames = 0


class ProtocolTests(unittest.TestCase):
    def test_grants(self):
        self.assertEqual(server.decode_ticket(ticket(), SECRET, ORIGIN, 'en-US')['language'], 'en-US')
        for value, origin, lang in [(ticket()+'x', ORIGIN, 'en-US'), (ticket(), 'https://evil.example', 'en-US'),
                                    (ticket(), ORIGIN, 'fr-FR'), (ticket(exp=0), ORIGIN, 'en-US'), (ticket(authenticated=1), ORIGIN, 'en-US'),
                                    ('not-a-ticket', ORIGIN, 'en-US')]:
            with self.assertRaises(server.ProtocolError):
                server.decode_ticket(value, SECRET, origin, lang)

    def test_languages(self):
        models={'en-US':'english','fr-FR':'french'}
        self.assertEqual(server.canonical_language('EN-us',models),'en-US')
        self.assertEqual(server.canonical_language('fr-FR',models),'fr-FR')
        for language in [None, 'en', 'de-DE', '../../en-US']:
            with self.assertRaises(server.ProtocolError):
                server.canonical_language(language,models)

    def test_socket(self):
        asyncio.run(self.exercise_socket())

    def test_login_deadline(self):
        asyncio.run(self.exercise_login_deadline())

    async def exercise_login_deadline(self):
        import websockets
        service=server.SpeechServer({'secret':SECRET,'origins':[ORIGIN],
            'models':{'en-US':'english'},'prelogin_seconds':.25,'max_anonymous_sessions':1},lambda path:path,FakeRecognizer)
        async with websockets.serve(service.handle,'127.0.0.1',0,origins=[ORIGIN]) as host:
            url='ws://127.0.0.1:'+str(host.sockets[0].getsockname()[1])+'/speech-ws'
            async def start(jti,authenticated=False):
                socket=await websockets.connect(url,origin=ORIGIN)
                await socket.send(json.dumps(dict(type='start',ticket=ticket(jti=jti*32,authenticated=authenticated),language='en-US',sampleRate=16000,format='pcm_s16le')))
                return socket,json.loads(await socket.recv())
            first,ready=await start('4')
            self.assertEqual(ready['preloginSeconds'],.25)
            busy,result=await start('5');self.assertEqual(result['code'],'busy');await busy.close()
            await first.send(json.dumps({'type':'authenticate','ticket':ticket(jti='6'*32,sub='c'*64,authenticated=True)}))
            self.assertTrue(json.loads(await first.recv())['authenticated'])
            await asyncio.sleep(.3)
            await first.send(b'\0'*1280);self.assertEqual(json.loads(await first.recv())['type'],'partial')
            self.assertEqual(service.anonymous,0)
            await first.send('{"type":"deauthenticate"}')
            self.assertFalse(json.loads(await first.recv())['authenticated'])
            started=time.monotonic()
            # Both audio and repeated downgrade controls must leave the original deadline intact.
            async def exchange(message):
                try:
                    await first.send(message)
                except websockets.exceptions.ConnectionClosed:
                    # A completed close can precede send; its ordered error
                    # response remains buffered and must still be verified.
                    pass
                return json.loads(await first.recv())
            while True:
                reply=await exchange(b'\0'*1280)
                if reply['type']=='error':break
                reply=await exchange('{"type":"deauthenticate"}')
                if reply['type']=='error':break
                await asyncio.sleep(.025)
            self.assertEqual(reply['code'],'login_timeout')
            self.assertLess(time.monotonic()-started,.6)
            await first.close();await asyncio.sleep(.01)
            self.assertEqual(service.anonymous,0)
            invalid,ready=await start('7')
            await invalid.send(json.dumps({'type':'authenticate','ticket':ticket(jti='8'*32)}))
            self.assertEqual(json.loads(await invalid.recv())['code'],'authentication_required');await invalid.close()
        self.assertEqual(sum(service.active.values()),0)
        service.pool.shutdown()

    async def exercise_socket(self):
        import websockets
        models=[]
        service=server.SpeechServer({'secret':SECRET,'origins':[ORIGIN],
                                    'models':{'en-US':'english','fr-FR':'french'},'max_sessions':1},
                                   lambda path: models.append(path) or path, FakeRecognizer)
        async with websockets.serve(service.handle,'127.0.0.1',0,origins=[ORIGIN],max_size=32768,process_request=service.http_request) as host:
            url='ws://127.0.0.1:'+str(host.sockets[0].getsockname()[1])+'/speech-ws'
            async def start(language='en-US', grant=None):
                socket=await websockets.connect(url,origin=ORIGIN)
                await socket.send(json.dumps(dict(type='start',ticket=grant or ticket(language),language=language,sampleRate=16000,format='pcm_s16le')))
                return socket,json.loads(await socket.recv())
            first,ready=await start('fr-FR')
            self.assertEqual(ready['language'],'fr-FR')
            self.assertEqual(models,['english','french'])
            await first.send(b'\0'*1280)
            result=json.loads(await first.recv())
            self.assertEqual(result['result']['partial'],'wake')
            self.assertEqual(result['acceptedSamples'],640)
            await first.send('{"type":"boundary"}')
            boundary=json.loads(await first.recv())
            self.assertTrue(boundary['boundary'])
            await first.send(b'\0'*1280)
            self.assertEqual(json.loads(await first.recv())['result']['partial'],'wake')
            busy,result=await start(grant=ticket(jti='2'*32))
            self.assertEqual(result['code'],'busy')
            await busy.close()
            await first.close()
            await asyncio.sleep(.01)
            replay,result=await start('fr-FR')
            self.assertEqual(result['code'],'ticket_used')
            await replay.close()
            invalid,result=await start('de-DE')
            self.assertEqual(result['code'],'unsupported_language')
            await invalid.close()
            odd,result=await start(grant=ticket(jti='3'*32))
            await odd.send(b'\0')
            self.assertEqual(json.loads(await odd.recv())['code'],'invalid_audio')
            await odd.close()
        self.assertEqual(sum(service.active.values()),0)
        service.pool.shutdown()


if __name__ == '__main__':
    if '--fixture' in sys.argv:
        # Browser fixture uses a real WebSocket and fake decoder; no acoustic claim.
        async def fixture():
            import websockets
            origins=json.loads(sys.argv[sys.argv.index('--fixture')+1])
            service=server.SpeechServer({'secret':SECRET,'origins':origins,'models':{'en-US':'english','fr-FR':'french'}},lambda path:path,FakeRecognizer)
            async with websockets.serve(service.handle,'127.0.0.1',0,origins=origins,max_size=32768,process_request=service.http_request) as host:
                print(json.dumps({'port':host.sockets[0].getsockname()[1]}),flush=True)
                await asyncio.Future()
        asyncio.run(fixture())
    else:
        unittest.main()

