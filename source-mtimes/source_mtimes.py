import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def source_mtimes(root, target, restore):
    root = Path(root)
    files = subprocess.check_output(
        ["git", "ls-files", "--recurse-submodules", "-z"], cwd=root
    ).decode().strip("\0").split("\0")
    state_path = root / target / ".setup-tessera-source-mtimes.json"
    previous = json.loads(state_path.read_text()) if state_path.exists() else {}
    current = {}
    directories = set()
    restored = 0
    for name in filter(None, files):
        source = root / name
        if source.is_symlink() or not source.is_file():
            continue
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        stat = source.stat()
        cached = previous.get("files", {}).get(name, {})
        if restore and cached.get("hash") == digest and "mtime_ns" in cached:
            # Cargo's package fingerprint includes exact nanoseconds, not just ordering.
            os.utime(source, ns=(stat.st_atime_ns, cached["mtime_ns"]))
            restored += 1
        current[name] = {"hash": digest, "mtime_ns": source.stat().st_mtime_ns}
        directories.update(parent.as_posix() for parent in Path(name).parents if parent != Path("."))

    directory_state = {}
    for name in sorted(directories, key=lambda item: item.count("/"), reverse=True):
        source = root / name
        entries = []
        for child in sorted(source.iterdir()):
            if child.name == ".git":
                continue
            relative = child.relative_to(root).as_posix()
            state = current.get(relative, directory_state.get(relative, {}))
            entries.append((child.name, child.is_dir(), state.get("hash")))
        # Never normalize a directory containing entries whose content is unverified.
        digest = None if any(entry[2] is None for entry in entries) else hashlib.sha256(
            json.dumps(entries).encode()
        ).hexdigest()
        cached = previous.get("directories", {}).get(name, {})
        if restore and digest is not None and cached.get("hash") == digest and "mtime_ns" in cached:
            os.utime(source, ns=(source.stat().st_atime_ns, cached["mtime_ns"]))
        directory_state[name] = {"hash": digest, "mtime_ns": source.stat().st_mtime_ns}

    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps({"files": current, "directories": directory_state}))
    print(f"Restored timestamps for {restored}/{len(current)} unchanged source files." if restore
          else f"Saved final timestamps for {len(current)} source files.")


if __name__ == "__main__":
    source_mtimes(sys.argv[1], sys.argv[2], sys.argv[3] == "restore")
