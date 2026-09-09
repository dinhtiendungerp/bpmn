#!/usr/bin/env python3
"""Package portable source without credentials, generated output or repository identity."""
import json
import os
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'public' / 'bpmn-studio-source.zip'
excluded = {'.git', 'node_modules', 'dist', '.next', '.wrangler', '.sites-runtime', 'coverage', 'outputs', 'work', '.vercel', '_site'}
files = []
for directory, dirs, names in os.walk(root):
    dirs[:] = sorted(d for d in dirs if d not in excluded)
    for name in sorted(names):
        path = Path(directory) / name
        if path == target or name.startswith('.env') or name.endswith(('.tsbuildinfo', '.log', '.pem')) or name == '.DS_Store':
            continue
        if path.is_symlink():
            continue
        files.append(path)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        relative = path.relative_to(root)
        data = path.read_bytes()
        if relative.as_posix() == '.openai/hosting.json':
            config = json.loads(data)
            config.pop('project_id', None)
            data = (json.dumps(config, indent=2) + '\n').encode()
        entry = zipfile.ZipInfo('bpmn-studio/' + relative.as_posix(), (2026, 9, 6, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = (0o755 if path.stat().st_mode & 0o111 else 0o644) << 16
        archive.writestr(entry, data)
print(f'{target} — {len(files)} source files, {target.stat().st_size} bytes')
