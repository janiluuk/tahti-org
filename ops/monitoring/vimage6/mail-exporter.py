# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
"""Serve ~/infra/mail/metrics/mail.prom with a Prometheus-compatible
Content-Type (plain `python -m http.server` sends .prom files as
application/octet-stream, which Prometheus v3 scrapes reject).

Runs as the monitoring-mail-exporter container on vimage6 (:9275).
Deployed by ops/monitoring/vimage6/deploy.sh.
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

DIR = Path('/metrics')
PORT = 9275


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path not in ('/metrics', '/mail.prom'):
            self.send_response(404)
            self.end_headers()
            return
        try:
            body = (DIR / 'mail.prom').read_bytes()
        except FileNotFoundError:
            self.send_response(503)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        pass


if __name__ == '__main__':
    HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
