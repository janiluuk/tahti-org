#!/usr/bin/env python3
"""Prometheus exporter: running Docker containers with IPs, ports, and web URLs."""

from __future__ import annotations

import http.client
import json
import os
import re
import socket
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import quote

HOST = os.environ.get("HOST_NAME", "unknown")
HOST_IP = os.environ.get("HOST_IP", "")
PORT = int(os.environ.get("EXPORTER_PORT", "9096"))
OVERRIDES_PATH = os.environ.get(
    "URL_OVERRIDES", "/etc/docker-catalog/url-overrides.json"
)
DOCKER_SOCK = os.environ.get("DOCKER_SOCK", "/var/run/docker.sock")

PORT_RE = re.compile(
    r"(?:0\.0\.0\.0:|(?:\[::\]:))?(?P<host_port>\d+)->(?P<container_port>\d+)/(?P<proto>\w+)"
)


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, unix_socket: str) -> None:
        super().__init__("localhost")
        self.unix_socket = unix_socket

    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.unix_socket)


def docker_get(path: str) -> Any:
    conn = UnixHTTPConnection(DOCKER_SOCK)
    conn.request("GET", path)
    response = conn.getresponse()
    body = response.read().decode("utf-8", errors="replace")
    if response.status >= 400:
        raise OSError(f"docker API {response.status} for {path}: {body[:200]}")
    return json.loads(body)


def load_overrides() -> dict[str, str]:
    if not os.path.isfile(OVERRIDES_PATH):
        return {}
    with open(OVERRIDES_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    out: dict[str, str] = {}
    for key, value in data.items():
        if isinstance(value, str):
            out[key] = value
        elif isinstance(value, dict) and "url" in value:
            out[key] = str(value["url"])
    return out


def esc(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def container_ip(info: dict[str, Any]) -> str:
    nets = info.get("NetworkSettings", {}).get("Networks", {})
    for net in nets.values():
        ip = net.get("IPAddress", "")
        if ip:
            return ip
    return ""


def parse_ports(raw: str) -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    if not raw:
        return out
    for chunk in raw.split(","):
        chunk = chunk.strip()
        m = PORT_RE.search(chunk)
        if m:
            out.append((m.group("host_port"), m.group("container_port"), m.group("proto")))
    return out


def running_containers() -> list[tuple[str, str, str, str]]:
    items = docker_get("/containers/json")
    rows: list[tuple[str, str, str, str]] = []
    for item in items:
        name = (item.get("Names") or [""])[0].lstrip("/")
        image = item.get("Image", "")
        cid = item.get("Id", "")
        ports_raw = ",".join(
            f"{p.get('IP', '0.0.0.0')}:{p.get('PublicPort', '')}->{p.get('PrivatePort', '')}/{p.get('Type', 'tcp')}"
            for p in (item.get("Ports") or [])
            if p.get("PublicPort")
        )
        rows.append((name, image, ports_raw, cid))
    return rows


def collect_metrics() -> str:
    overrides = load_overrides()
    lines = [
        "# HELP docker_catalog_info Running container with published port or override URL",
        "# TYPE docker_catalog_info gauge",
    ]

    for name, image, ports_raw, container_id in running_containers():
        try:
            info = docker_get(f"/containers/{container_id}/json")
        except (json.JSONDecodeError, KeyError, OSError):
            info = {}
        ip = container_ip(info) if info else ""
        published = parse_ports(ports_raw)

        if name in overrides:
            url = overrides[name]
            lines.append(
                f'docker_catalog_info{{host="{esc(HOST)}",host_ip="{esc(HOST_IP)}",'
                f'name="{esc(name)}",container_ip="{esc(ip)}",image="{esc(image)}",'
                f'host_port="",container_port="",proto="http",'
                f'web_url="{esc(url)}"}} 1'
            )
            continue

        if not published:
            continue

        for host_port, container_port, proto in published:
            scheme = "https" if host_port in {"443", "8443"} else "http"
            url = f"{scheme}://{HOST_IP}:{host_port}" if HOST_IP else ""
            lines.append(
                f'docker_catalog_info{{host="{esc(HOST)}",host_ip="{esc(HOST_IP)}",'
                f'name="{esc(name)}",container_ip="{esc(ip)}",image="{esc(image)}",'
                f'host_port="{host_port}",container_port="{container_port}",proto="{proto}",'
                f'web_url="{esc(url)}"}} 1'
            )

    lines.append(
        "# HELP docker_catalog_scrape_timestamp_seconds Unix time of last scrape"
    )
    lines.append("# TYPE docker_catalog_scrape_timestamp_seconds gauge")
    lines.append(f"docker_catalog_scrape_timestamp_seconds {int(time.time())}")
    return "\n".join(lines) + "\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path not in ("/", "/metrics"):
            self.send_error(404)
            return
        try:
            body = collect_metrics().encode()
        except OSError as exc:
            self.send_error(500, str(exc))
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def main() -> None:
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"docker-catalog-exporter on :{PORT} host={HOST} ip={HOST_IP}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
