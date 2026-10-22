"""Native Vosk + actual WebSockets, silence transport/lifecycle, not accuracy."""
import asyncio
import importlib.util
import json
import sys
import tarfile
import tempfile
from pathlib import Path

spec=importlib.util.spec_from_file_location('fixture',Path(__file__).with_name('speech-server.py'))
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


async def exercise(model_path):
    import websockets
    from vosk import Model, KaldiRecognizer, SetLogLevel
    SetLogLevel(-1)
    service=fixture.server.SpeechServer({'secret':fixture.SECRET,'origins':[fixture.ORIGIN],
        'models':{'en-US':str(model_path)}},Model,KaldiRecognizer)
    async with websockets.serve(service.handle,'127.0.0.1',0,origins=[fixture.ORIGIN]) as host:
        url='ws://127.0.0.1:'+str(host.sockets[0].getsockname()[1])+'/speech-ws'
        async with websockets.connect(url,origin=fixture.ORIGIN) as socket:
            await socket.send(json.dumps({'type':'start','ticket':fixture.ticket(),'language':'en-US','sampleRate':16000,'format':'pcm_s16le'}))
            assert json.loads(await socket.recv())['type']=='ready'
            for i in range(9):
                await socket.send(b'\0'*6400)
                response=json.loads(await socket.recv())
                assert response['acceptedSamples']==(i+1)*3200
                await socket.send('{"type":"boundary"}')
                boundary=json.loads(await socket.recv())
                assert boundary['boundary']
                assert isinstance(boundary['result']['alternatives'],list), 'Native alternatives must be enabled'
    service.pool.shutdown()
    print('PASS native Vosk server: one socket, nine boundaries, 28800 samples acknowledged once')


if __name__=='__main__':
    model=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'speech/vosk/models/vosk-model-small-en-us-0.15.tar.gz'
    if model.is_dir():
        asyncio.run(exercise(model))
    else:
        with tempfile.TemporaryDirectory(prefix='clocktimer-native-vosk-') as work:
            root=Path(work).resolve()
            with tarfile.open(model) as archive:
                for member in archive.getmembers():
                    target=(root/member.name).resolve()
                    if root not in target.parents or member.issym() or member.islnk():
                        raise ValueError('Unsafe model member')
                archive.extractall(root)
            asyncio.run(exercise(root/'model'))
