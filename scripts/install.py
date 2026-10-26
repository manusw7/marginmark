#!/usr/bin/env python3
"""Install this user's native host without changing Firefox security settings."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'host'))
from store import DEFAULT_VAULT
p = argparse.ArgumentParser(); p.add_argument('--vault', type=Path, default=DEFAULT_VAULT); a = p.parse_args()
project = Path(__file__).resolve().parents[1]
host = project / 'host/native.py'; host.chmod(0o755)
config = project / 'host/config.json'
config.write_text(json.dumps({'vault': str(a.vault.resolve())}, indent=2) + '\n'); config.chmod(0o600)
folder = Path.home() / '.mozilla/native-messaging-hosts'; folder.mkdir(parents=True, exist_ok=True)
manifest = folder / 'marginmark.json'
manifest.write_text(json.dumps({'name': 'marginmark', 'description': 'Marginmark vault storage', 'path': str(host), 'type': 'stdio', 'allowed_extensions': ['marginmark@local']}, indent=2) + '\n'); manifest.chmod(0o600)
print('Native host installato:', manifest); print('Vault:', a.vault.resolve())
