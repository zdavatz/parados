#!/usr/bin/env python3
import json
import os
import re
import sys
from datetime import datetime

CSV_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'csv')

print("Content-Type: application/json")
print("Access-Control-Allow-Origin: *")
print("Access-Control-Allow-Methods: POST, OPTIONS")
print("Access-Control-Allow-Headers: Content-Type")
print()

if os.environ.get('REQUEST_METHOD') == 'OPTIONS':
    print(json.dumps({"ok": True}))
    sys.exit(0)

if os.environ.get('REQUEST_METHOD') != 'POST':
    print(json.dumps({"error": "POST required"}))
    sys.exit(0)

try:
    content_length = int(os.environ.get('CONTENT_LENGTH', 0))
    body = sys.stdin.read(content_length)
    data = json.loads(body)

    game_name = data.get('game', 'unknown')
    csv_content = data.get('csv', '')

    # Sanitize game name: only allow alphanumeric, underscore, hyphen
    game_name = re.sub(r'[^a-zA-Z0-9_-]', '', game_name)
    if not game_name:
        game_name = 'unknown'

    if not csv_content:
        print(json.dumps({"error": "No CSV data"}))
        sys.exit(0)

    now = datetime.now()
    filename = f"{game_name}_{now.strftime('%H%M')}_{now.strftime('%d.%m.%Y')}.csv"
    filepath = os.path.join(CSV_DIR, filename)

    # Avoid overwriting: append suffix if file exists
    base, ext = os.path.splitext(filepath)
    counter = 1
    while os.path.exists(filepath):
        filepath = f"{base}_{counter}{ext}"
        counter += 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(csv_content)

    print(json.dumps({"ok": True, "filename": os.path.basename(filepath)}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
