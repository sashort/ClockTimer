"""Install pinned, same-origin Vosk assets; never commit model binaries."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile

RUNTIME_URL = "https://registry.npmjs.org/vosk-browser/-/vosk-browser-0.0.8.tgz"
RUNTIME_SHA256 = "fd16fc7e64c935d7a79cf07c8f67d84232b6485376a59144af8a234979a9a4b4"
MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
MODEL_SHA256 = "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"
MODEL_FOLDER = "vosk-model-small-en-us-0.15"


def checksum(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verified_source(url, expected, output, source_dir):
    cached = source_dir / output.name if source_dir else None
    if cached and cached.is_file():
        shutil.copyfile(cached, output)
    else:
        print("Downloading " + url, flush=True)
        with urllib.request.urlopen(url, timeout=90) as response, output.open("wb") as stream:
            shutil.copyfileobj(response, stream)
    if checksum(output) != expected:
        raise RuntimeError("SHA256 mismatch for " + output.name)


def install(root, source_dir=None):
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    runtime = root / "runtime" / "vosk-0.0.8.js"
    model = root / "models" / (MODEL_FOLDER + ".tar.gz")
    manifest_path = root / "assets.json"
    if manifest_path.is_file() and runtime.is_file() and model.is_file():
        manifest = json.loads(manifest_path.read_text())
        if (manifest.get("runtime_source_sha256") == RUNTIME_SHA256 and
                manifest.get("model_archive_format") == 2 and
                manifest.get("model_source_sha256") == MODEL_SHA256 and
                manifest.get("runtime_sha256") == checksum(runtime) and
                manifest.get("model_sha256") == checksum(model)):
            print("Pinned Vosk assets already installed and verified.")
            return
    # All downloads and validation finish before replacing any served file.
    with tempfile.TemporaryDirectory(prefix="install-", dir=root) as scratch:
        scratch = Path(scratch)
        runtime_source = scratch / "vosk-browser-0.0.8.tgz"
        model_source = scratch / (MODEL_FOLDER + ".zip")
        verified_source(RUNTIME_URL, RUNTIME_SHA256, runtime_source, source_dir)
        verified_source(MODEL_URL, MODEL_SHA256, model_source, source_dir)
        runtime_output = scratch / runtime.name
        with tarfile.open(runtime_source, "r:gz") as archive:
            with archive.extractfile("package/dist/vosk.js") as stream, runtime_output.open("wb") as output:
                shutil.copyfileobj(stream, output)
        model_output = scratch / model.name
        with zipfile.ZipFile(model_source) as archive:
            members = sorted(member for member in archive.namelist() if not member.endswith("/"))
            required = ["am/final.mdl", "conf/model.conf", "conf/mfcc.conf", "graph/HCLr.fst", "graph/Gr.fst"]
            if any(MODEL_FOLDER + "/" + name not in members for name in required):
                raise RuntimeError("Model is missing dynamic-grammar assets")
            with model_output.open("wb") as output, gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT) as tar:
                    directories = {"model"}
                    for member in members:
                        relative = PurePosixPath("model", *PurePosixPath(member).parts[1:])
                        directories.update(str(parent) for parent in relative.parents if str(parent) != ".")
                    for directory in sorted(directories):
                        info = tarfile.TarInfo(directory + "/")
                        info.type = tarfile.DIRTYPE
                        info.mode = 0o755
                        tar.addfile(info)
                    for member in members:
                        path = PurePosixPath(member)
                        if path.parts[0] != MODEL_FOLDER or ".." in path.parts or path.is_absolute():
                            raise RuntimeError("Unexpected model archive path")
                        info = tarfile.TarInfo("model/" + "/".join(path.parts[1:]))
                        info.size = archive.getinfo(member).file_size
                        info.mode = 0o644
                        with archive.open(member) as stream:
                            tar.addfile(info, stream)
        manifest = {"runtime_version": "0.0.8", "model": MODEL_FOLDER, "model_archive_format": 2,
                    "runtime_source_sha256": RUNTIME_SHA256, "model_source_sha256": MODEL_SHA256,
                    "runtime_sha256": checksum(runtime_output), "model_sha256": checksum(model_output)}
        for destination, prepared in [(runtime, runtime_output), (model, model_output)]:
            destination.parent.mkdir(parents=True, exist_ok=True)
            prepared.chmod(0o644)
            prepared.replace(destination)
        manifest_output = scratch / "assets.json"
        manifest_output.write_text(json.dumps(manifest, indent=2) + "\n")
        manifest_output.chmod(0o644)
        manifest_output.replace(manifest_path)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1] / "speech/vosk")
    parser.add_argument("--source-dir", type=Path)
    args = parser.parse_args()
    install(args.root, args.source_dir)
