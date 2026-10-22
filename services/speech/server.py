#!/usr/bin/env python3
"""Private Vosk streaming worker. Apache owns TLS; PHP issues short-lived grants.

Audio and transcripts are deliberately never written to logs or disk.
"""
import asyncio
import base64
import concurrent.futures
import hashlib
import hmac
import json
import os
import re
import time
from collections import Counter
from http import HTTPStatus
from pathlib import Path


class ProtocolError(Exception):
    def __init__(self, code):
        self.code = code


def canonical_language(language, models):
    if not isinstance(language, str) or not re.fullmatch(r"[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", language):
        raise ProtocolError("unsupported_language")
    for supported in models:
        if language.lower() == supported.lower():
            return supported
    raise ProtocolError("unsupported_language")


def decode_ticket(ticket, secret, origin, language, now=None):
    now = time.time() if now is None else now
    try:
        if not isinstance(ticket, str) or len(ticket) > 2048:
            raise ValueError()
        encoded, signature = ticket.split(".")
        expected = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        grant = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if (grant.get("v") != 1 or grant.get("aud") != "clocktimer-speech"
                or grant.get("origin") != origin or grant.get("language") != language
                or type(grant.get("authenticated")) is not bool
                or not isinstance(grant.get("iat"), int) or not isinstance(grant.get("exp"), int)
                or grant["iat"] > now + 5 or grant["exp"] <= now
                or not 0 < grant["exp"] - grant["iat"] <= 60
                or not re.fullmatch(r"[a-f0-9]{32}", grant.get("jti", ""))
                or not re.fullmatch(r"[a-f0-9]{64}", grant.get("sub", ""))):
            raise ValueError()
        return grant
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise ProtocolError("invalid_ticket") from None


def decode_audio(recognizer, message):
    endpoint = recognizer.AcceptWaveform(message)
    return {"type": "result" if endpoint else "partial",
            "result": json.loads(recognizer.Result() if endpoint else recognizer.PartialResult())}


class SpeechServer:
    def __init__(self, config, model_factory, recognizer_factory):
        if len(config.get("secret", "")) < 64 or not config.get("origins") or not config.get("models"):
            raise ValueError("Speech configuration needs a secret, allowed origins and language models.")
        self.config = config
        # One read-only model per configured locale, shared by recognizers.
        self.models = {language: model_factory(path) for language, path in config["models"].items()}
        self.recognizer_factory = recognizer_factory
        self.active = Counter()
        self.used = {}
        self.connections = 0
        self.anonymous = 0
        self.pool = concurrent.futures.ThreadPoolExecutor(max_workers=config.get("workers", 2))

    def health(self):
        return {"status": "ready", "protocol": 1, "languages": list(self.models),
                "activeSessions": sum(self.active.values()), "anonymousSessions": self.anonymous,
                "maxSessions": self.config.get("max_sessions", 4)}

    async def http_request(self, path, headers):
        if path == "/health":
            return HTTPStatus.OK, [("Content-Type", "application/json"), ("Cache-Control", "no-store")], json.dumps(self.health()).encode()
        if path != "/speech-ws":
            return HTTPStatus.NOT_FOUND, [], b"Not found"
        return None

    async def handle(self, socket, path):
        if path != "/speech-ws":
            await socket.close(1008, "invalid_path")
            return
        if self.connections >= 16:
            await socket.close(1013, "busy")
            return
        self.connections += 1
        subject = None
        counted_anonymous = False
        try:
            origin = socket.request_headers.get("Origin")
            if origin not in self.config["origins"]:
                raise ProtocolError("origin_denied")
            first = await asyncio.wait_for(socket.recv(), 5)
            if not isinstance(first, str) or len(first) > 4096:
                raise ProtocolError("invalid_start")
            request = json.loads(first)
            if request.get("type") != "start" or request.get("sampleRate") != 16000 or request.get("format") != "pcm_s16le":
                raise ProtocolError("invalid_start")
            language = canonical_language(request.get("language"), self.models)
            grant = decode_ticket(request.get("ticket"), self.config["secret"], origin, language)
            now = time.time()
            self.used = {key: expiry for key, expiry in self.used.items() if expiry > now}
            if grant["jti"] in self.used:
                raise ProtocolError("ticket_used")
            authenticated = grant['authenticated']
            if (sum(self.active.values()) >= self.config.get("max_sessions", 4) or self.active[grant["sub"]] >= 2
                    or (not authenticated and self.anonymous >= self.config.get("max_anonymous_sessions", 2))):
                raise ProtocolError("busy")
            self.used[grant["jti"]] = grant["exp"]
            subject = grant["sub"]
            self.active[subject] += 1
            if not authenticated:
                self.anonymous += 1
                counted_anonymous = True
            loop = asyncio.get_running_loop()
            recognizer = await loop.run_in_executor(self.pool, self.recognizer_factory, self.models[language], 16000)
            recognizer.SetMaxAlternatives(max(1,min(30,int(self.config.get("max_alternatives",10)))))
            recognizer.SetWords(True)
            await socket.send(json.dumps({"type": "ready", "protocol": 1, "language": language,
                "sampleRate": 16000, "authenticated": authenticated,
                "preloginSeconds": None if authenticated else self.config.get("prelogin_seconds", 10)}))
            samples = 0
            started = time.monotonic()
            login_deadline = started + self.config.get("prelogin_seconds", 10)
            while True:
                remaining = self.config.get("max_session_seconds", 28800) - (time.monotonic() - started)
                if not authenticated:
                    remaining = min(remaining, login_deadline-time.monotonic())
                if remaining <= 0:
                    raise ProtocolError("session_expired" if authenticated else "login_timeout")
                try:
                    message = await asyncio.wait_for(socket.recv(), min(60, remaining))
                except asyncio.TimeoutError:
                    raise ProtocolError(("session_expired" if authenticated else "login_timeout") if remaining <= 60 else "audio_idle_timeout") from None
                if not authenticated and time.monotonic() >= login_deadline:
                    raise ProtocolError("login_timeout")
                if isinstance(message, bytes):
                    if not message or len(message) % 2 or len(message) > 32000:
                        raise ProtocolError("invalid_audio")
                    samples += len(message) // 2
                    # Live input may have a small buffered lead, never an unbounded upload.
                    if samples > (time.monotonic() - started + 5) * 16000:
                        raise ProtocolError("audio_rate_exceeded")
                    response = await loop.run_in_executor(self.pool, decode_audio, recognizer, message)
                    response["acceptedSamples"] = samples
                    await socket.send(json.dumps(response))
                else:
                    if len(message) > 4096:
                        raise ProtocolError("invalid_control")
                    control = json.loads(message)
                    if control == {"type": "deauthenticate"}:
                        if authenticated:
                            if self.anonymous >= self.config.get("max_anonymous_sessions", 2):
                                raise ProtocolError("busy")
                            authenticated = False
                            self.anonymous += 1
                            counted_anonymous = True
                            login_deadline = time.monotonic() + self.config.get("prelogin_seconds", 10)
                        # Repeating a downgrade never extends an existing deadline.
                        await socket.send(json.dumps({"type":"authentication", "authenticated":False, "preloginSeconds": max(0, login_deadline-time.monotonic())}))
                        continue
                    if isinstance(control, dict) and set(control) == {"type", "ticket"} and control["type"] == "authenticate":
                        upgrade = decode_ticket(control["ticket"], self.config["secret"], origin, language)
                        if not upgrade["authenticated"]:
                            raise ProtocolError("authentication_required")
                        if upgrade["jti"] in self.used:
                            raise ProtocolError("ticket_used")
                        if upgrade['sub'] != subject and self.active[upgrade['sub']] >= 2:
                            raise ProtocolError("busy")
                        self.used[upgrade["jti"]] = upgrade["exp"]
                        self.active[subject] -= 1
                        if not self.active[subject]:
                            del self.active[subject]
                        subject = upgrade['sub']
                        self.active[subject] += 1
                        authenticated = True
                        if counted_anonymous:
                            self.anonymous -= 1
                            counted_anonymous = False
                        await socket.send(json.dumps({"type":"authentication", "authenticated":True, "preloginSeconds":None}))
                        continue
                    if control != {"type":"boundary"}:
                        raise ProtocolError("invalid_control")
                    result = await loop.run_in_executor(self.pool, recognizer.FinalResult)
                    recognizer.Reset()
                    await socket.send(json.dumps({"type": "result", "result": json.loads(result), "boundary": True}))
        except ProtocolError as error:
            await socket.send(json.dumps({"type": "error", "code": error.code}))
            await socket.close(1013 if error.code == "busy" else 1008, error.code)
        except (ValueError, TypeError, AttributeError, asyncio.TimeoutError):
            await socket.close(1008, "invalid_request")
        except Exception as error:
            # Disconnects are normal. Do not log native exceptions with input
            # context; a failed decoder explicitly closes only its own session.
            from websockets.exceptions import ConnectionClosed
            if not isinstance(error, ConnectionClosed):
                await socket.close(1011, "recognition_failed")
        finally:
            self.connections -= 1
            if counted_anonymous:
                self.anonymous -= 1
            if subject:
                self.active[subject] -= 1
                if not self.active[subject]:
                    del self.active[subject]


async def main():
    from vosk import Model, KaldiRecognizer, SetLogLevel
    import websockets
    SetLogLevel(-1)
    config = json.loads(Path(os.environ.get("CLOCKTIMER_SPEECH_CONFIG", "/etc/clocktimer/speech.json")).read_text())
    service = SpeechServer(config, Model, KaldiRecognizer)
    async with websockets.serve(service.handle, "127.0.0.1", 8766,
                                origins=config["origins"], process_request=service.http_request,
                                max_size=32768, max_queue=4, ping_interval=20, ping_timeout=30):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
