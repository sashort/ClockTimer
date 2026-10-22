#!/usr/bin/env python3
"""Install pinned models outside the document root; never accept model paths from clients."""
import argparse
import hashlib
import json
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path


def capacity(root):
    memory = {key: int(value.split()[0])*1024 for key, value in
              (line.split(":", 1) for line in Path('/proc/meminfo').read_text().splitlines())}
    disk = shutil.disk_usage(root)
    allocation = Path('/sys/fs/cgroup/system.slice/clocktimer-speech.service/memory.current')
    reclaimable_service = int(allocation.read_text()) if allocation.is_file() else 0
    result = {'ramGiB': round(memory['MemTotal']/2**30, 1),
              'availableGiB': round(memory['MemAvailable']/2**30, 1),
              'existingSpeechGiB': round(reclaimable_service/2**30, 1),
              'diskFreeGiB': round(disk.free/2**30, 1), 'cpus': os.cpu_count()}
    # Conservative allowance for one large model plus Apache/database/diagnostics.
    if memory['MemTotal'] < 15*2**30 or memory['MemAvailable'] + reclaimable_service < 12*2**30 or disk.free < 10*2**30:
        raise SystemExit('Speech capacity check failed: '+json.dumps(result)+
                         '. Need a 16 GiB host, 12 GiB currently available RAM, and 10 GiB free disk; do not resize automatically.')
    return result


def install_model(spec, root):
    target = root/spec['name']
    marker = target/'.clocktimer-model.json'
    if marker.is_file() and json.loads(marker.read_text()) == spec:
        return target
    if target.exists():
        raise SystemExit('Existing unverified model directory needs review: '+str(target))
    with tempfile.TemporaryDirectory(prefix='speech-install-', dir=str(root)) as work:
        work = Path(work)
        archive = work/'model.zip'
        digest = hashlib.md5()
        size = 0
        with urllib.request.urlopen(spec['url'], timeout=60) as response, archive.open('wb') as output:
            while True:
                block = response.read(1024*1024)
                if not block:
                    break
                size += len(block)
                if size > spec['bytes']:
                    raise ValueError('Model exceeds pinned archive size')
                digest.update(block)
                output.write(block)
        if size != spec['bytes'] or digest.hexdigest() != spec['md5']:
            raise ValueError('Pinned model checksum/size does not match the official Vosk catalog')
        with zipfile.ZipFile(archive) as package:
            for member in package.infolist():
                resolved = (work/member.filename).resolve()
                if work.resolve() not in resolved.parents or member.file_size > 4*2**30:
                    raise ValueError('Unsafe model archive member')
            if sum(member.file_size for member in package.infolist()) > 8*2**30:
                raise ValueError('Expanded model exceeds limit')
            package.extractall(work)
        model = work/spec['name']
        for required in ['am/final.mdl', 'conf/model.conf', 'graph/words.txt']:
            if not (model/required).is_file():
                raise ValueError('Incomplete Vosk model')
        (model/'.clocktimer-model.json').write_text(json.dumps(spec))
        model.rename(target)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='/var/lib/clocktimer/speech/models')
    parser.add_argument('--language', default='en-US')
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    root = Path(args.root)
    root.mkdir(parents=True, exist_ok=True)
    print(json.dumps(capacity(root)), flush=True)
    if not args.check_only:
        manifest = json.loads((Path(__file__).parent/'speech-models.json').read_text())
        if args.language not in manifest:
            raise SystemExit('No pinned model for '+args.language)
        print(install_model(manifest[args.language], root), flush=True)
