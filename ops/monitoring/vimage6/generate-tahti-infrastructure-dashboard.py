#!/usr/bin/env python3
"""Generate ops/monitoring/vimage6/tahti-infrastructure.json for Grafana."""
from __future__ import annotations

import json
from pathlib import Path

DS = {"type": "prometheus", "uid": "P501B54A0D5548634"}
HOSTS = "vimage|vimage2|vimage3|vimage4|vimage5|vimage6|pi4|pi5|web"
NET_DEV = 'device!~"lo|veth.*|docker.*|br-.*|cali.*|flannel.*|cni.*"'


def row(title: str, y: int, panel_id: int) -> dict:
    return {
        "id": panel_id,
        "type": "row",
        "title": title,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "collapsed": False,
    }


def stat_panel(
    panel_id: int,
    title: str,
    expr: str,
    y: int,
    w: int = 24,
    h: int = 4,
    x: int = 0,
    legend: str = "{{instance}}",
    description: str = "",
) -> dict:
    return {
        "id": panel_id,
        "type": "stat",
        "title": title,
        "description": description,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": DS,
        "fieldConfig": {
            "defaults": {
                "mappings": [
                    {
                        "type": "value",
                        "options": {
                            "1": {"text": "UP", "color": "green"},
                            "0": {"text": "DOWN", "color": "red"},
                        },
                    }
                ],
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "red", "value": None},
                        {"color": "green", "value": 1},
                    ],
                },
            }
        },
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"]},
            "colorMode": "background",
            "orientation": "horizontal",
            "textMode": "auto",
        },
        "targets": [
            {
                "expr": expr,
                "legendFormat": legend,
                "instant": True,
                "refId": "A",
            }
        ],
    }


def timeseries_panel(
    panel_id: int,
    title: str,
    expr: str,
    y: int,
    w: int = 12,
    h: int = 8,
    x: int = 0,
    unit: str = "short",
    legend: str = "{{instance}}",
    description: str = "",
) -> dict:
    return {
        "id": panel_id,
        "type": "timeseries",
        "title": title,
        "description": description,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": DS,
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "custom": {"drawStyle": "line", "lineWidth": 2, "fillOpacity": 10},
            }
        },
        "options": {"legend": {"displayMode": "list", "placement": "bottom"}},
        "targets": [{"expr": expr, "legendFormat": legend, "refId": "A"}],
    }


def bargauge_panel(
    panel_id: int,
    title: str,
    expr: str,
    y: int,
    w: int = 12,
    h: int = 8,
    x: int = 0,
    unit: str = "percent",
    thresholds: list | None = None,
) -> dict:
    steps = thresholds or [
        {"color": "red", "value": None},
        {"color": "orange", "value": 10},
        {"color": "yellow", "value": 20},
        {"color": "green", "value": 30},
    ]
    return {
        "id": panel_id,
        "type": "bargauge",
        "title": title,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": DS,
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "min": 0,
                "max": 100 if unit == "percent" else None,
                "thresholds": {"mode": "absolute", "steps": steps},
            }
        },
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"]},
            "orientation": "horizontal",
            "displayMode": "gradient",
        },
        "targets": [
            {
                "expr": expr,
                "legendFormat": "{{instance}}",
                "instant": True,
                "refId": "A",
            }
        ],
    }


def main() -> None:
    panels: list[dict] = []
    pid = 1
    y = 0

    panels.append(row("Host availability", y, pid))
    pid += 1
    y += 1
    panels.append(
        stat_panel(
            pid,
            "Hosts — node exporter",
            f'up{{job="node",instance=~"{HOSTS}"}}',
            y,
            description="1 = host reachable and node_exporter responding.",
        )
    )
    pid += 1
    y += 4
    panels.append(
        stat_panel(
            pid,
            "Hosts — cAdvisor",
            f'up{{job="cadvisor",instance=~"{HOSTS}"}}',
            y,
            w=12,
            description="Container metrics agent on each host.",
        )
    )
    pid += 1
    panels.append(
        stat_panel(
            pid,
            "Hosts — docker catalog",
            f'up{{job="docker-catalog",instance=~"{HOSTS}"}}',
            y,
            w=12,
            x=12,
            description="Lists running containers per host.",
        )
    )
    pid += 1
    y += 4

    panels.append(row("Tahti lab stack (vimage)", y, pid))
    pid += 1
    y += 1
    panels.append(
        stat_panel(
            pid,
            "Lab HTTP probes",
            'probe_success{job=~"tahti_blackbox|tahti_blackbox_orchestrator"}',
            y,
            legend="{{service}}",
            description="Direct LAN probes to stack ports on 192.168.2.100.",
        )
    )
    pid += 1
    y += 4
    panels.append(
        stat_panel(
            pid,
            "API healthy",
            'tahti_api_healthy{job="tahti_api_metrics"}',
            y,
            w=6,
        )
    )
    pid += 1
    panels.append(
        stat_panel(
            pid,
            "API dependencies",
            'tahti_dependency_up{job="tahti_api_metrics"}',
            y,
            w=18,
            x=6,
            legend="{{dependency}}",
        )
    )
    pid += 1
    y += 4
    panels.append(
        stat_panel(
            pid,
            "API metrics scrape",
            'up{job="tahti_api_metrics"}',
            y,
            w=6,
        )
    )
    pid += 1
    panels.append(
        {
            "id": pid,
            "type": "stat",
            "title": "Postgres backup age (h)",
            "gridPos": {"h": 4, "w": 6, "x": 6, "y": y},
            "datasource": DS,
            "fieldConfig": {
                "defaults": {
                    "unit": "h",
                    "decimals": 1,
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {"color": "green", "value": None},
                            {"color": "yellow", "value": 26},
                            {"color": "red", "value": 48},
                        ],
                    },
                }
            },
            "options": {
                "reduceOptions": {"calcs": ["lastNotNull"]},
                "colorMode": "background",
            },
            "targets": [
                {
                    "expr": 'tahti_postgres_backup_age_hours{job="tahti_api_metrics"}',
                    "legendFormat": "{{host}}",
                    "instant": True,
                    "refId": "A",
                }
            ],
        }
    )
    pid += 1
    y += 4

    panels.append(row("Public endpoints (via NPM / DNS)", y, pid))
    pid += 1
    y += 1
    panels.append(
        stat_panel(
            pid,
            "HTTPS probes",
            'probe_success{job="tahti_blackbox_public"}',
            y,
            legend="{{service}}",
            description="Blackbox checks from vimage6 to public tahti.live hostnames.",
        )
    )
    pid += 1
    y += 4
    panels.append(
        stat_panel(
            pid,
            "SMTP submission (mail.tahti.live:587)",
            'probe_success{job="tahti_blackbox_tcp"}',
            y,
            w=8,
            legend="{{service}}",
        )
    )
    pid += 1
    y += 4

    panels.append(row("CPU & load", y, pid))
    pid += 1
    y += 1
    panels.append(
        timeseries_panel(
            pid,
            "CPU usage %",
            f'100 - (avg by (instance) (rate(node_cpu_seconds_total{{mode="idle",instance=~"{HOSTS}"}}[5m])) * 100)',
            y,
            unit="percent",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Load average (1m)",
            f'node_load1{{instance=~"{HOSTS}"}}',
            y,
            x=12,
        )
    )
    pid += 1
    y += 8

    panels.append(row("Memory", y, pid))
    pid += 1
    y += 1
    panels.append(
        timeseries_panel(
            pid,
            "Memory used %",
            f'(1 - node_memory_MemAvailable_bytes{{instance=~"{HOSTS}"}} / node_memory_MemTotal_bytes{{instance=~"{HOSTS}"}}) * 100',
            y,
            w=24,
            unit="percent",
        )
    )
    pid += 1
    y += 8

    panels.append(row("Disk space & I/O", y, pid))
    pid += 1
    y += 1
    panels.append(
        bargauge_panel(
            pid,
            "Root filesystem free %",
            f'(node_filesystem_avail_bytes{{instance=~"{HOSTS}",mountpoint="/",fstype!~"tmpfs|overlay|squashfs"}} / node_filesystem_size_bytes{{instance=~"{HOSTS}",mountpoint="/",fstype!~"tmpfs|overlay|squashfs"}}) * 100',
            y,
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Root disk used %",
            f'(1 - node_filesystem_avail_bytes{{instance=~"{HOSTS}",mountpoint="/",fstype!~"tmpfs|overlay|squashfs"}} / node_filesystem_size_bytes{{instance=~"{HOSTS}",mountpoint="/",fstype!~"tmpfs|overlay|squashfs"}}) * 100',
            y,
            x=12,
            unit="percent",
        )
    )
    pid += 1
    y += 8
    panels.append(
        timeseries_panel(
            pid,
            "Disk read throughput",
            f'sum by (instance) (rate(node_disk_read_bytes_total{{instance=~"{HOSTS}"}}[5m]))',
            y,
            unit="Bps",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Disk write throughput",
            f'sum by (instance) (rate(node_disk_written_bytes_total{{instance=~"{HOSTS}"}}[5m]))',
            y,
            x=12,
            unit="Bps",
        )
    )
    pid += 1
    y += 8
    panels.append(
        timeseries_panel(
            pid,
            "Disk read IOPS",
            f'sum by (instance) (rate(node_disk_reads_completed_total{{instance=~"{HOSTS}"}}[5m]))',
            y,
            unit="iops",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Disk write IOPS",
            f'sum by (instance) (rate(node_disk_writes_completed_total{{instance=~"{HOSTS}"}}[5m]))',
            y,
            x=12,
            unit="iops",
        )
    )
    pid += 1
    y += 8

    panels.append(row("Network", y, pid))
    pid += 1
    y += 1
    panels.append(
        timeseries_panel(
            pid,
            "Network receive",
            f'sum by (instance) (rate(node_network_receive_bytes_total{{instance=~"{HOSTS}",{NET_DEV}}}[5m]))',
            y,
            unit="Bps",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Network transmit",
            f'sum by (instance) (rate(node_network_transmit_bytes_total{{instance=~"{HOSTS}",{NET_DEV}}}[5m]))',
            y,
            x=12,
            unit="Bps",
        )
    )
    pid += 1
    y += 8
    panels.append(
        timeseries_panel(
            pid,
            "Network receive errors",
            f'sum by (instance) (rate(node_network_receive_errs_total{{instance=~"{HOSTS}",{NET_DEV}}}[5m]))',
            y,
            unit="pps",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Network transmit errors",
            f'sum by (instance) (rate(node_network_transmit_errs_total{{instance=~"{HOSTS}",{NET_DEV}}}[5m]))',
            y,
            x=12,
            unit="pps",
        )
    )
    pid += 1
    y += 8

    panels.append(row("Tahti containers on vimage", y, pid))
    pid += 1
    y += 1
    panels.append(
        timeseries_panel(
            pid,
            "Container CPU (cores)",
            'sum by (name) (rate(container_cpu_usage_seconds_total{instance="vimage",name=~"tahti.*|/tahti.*"}[5m]))',
            y,
            legend="{{name}}",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Container memory",
            'container_memory_usage_bytes{instance="vimage",name=~"tahti.*|/tahti.*"}',
            y,
            x=12,
            unit="bytes",
            legend="{{name}}",
        )
    )
    pid += 1
    y += 8
    panels.append(
        timeseries_panel(
            pid,
            "Blackbox probe duration (lab)",
            'probe_duration_seconds{job=~"tahti_blackbox|tahti_blackbox_orchestrator"}',
            y,
            w=12,
            unit="s",
            legend="{{service}}",
        )
    )
    pid += 1
    panels.append(
        timeseries_panel(
            pid,
            "Dependency check latency",
            'tahti_dependency_check_latency_ms{job="tahti_api_metrics"}',
            y,
            x=12,
            w=12,
            unit="ms",
            legend="{{dependency}}",
        )
    )

    dashboard = {
        "title": "Tahti — infrastructure & services",
        "uid": "tahti-infrastructure",
        "schemaVersion": 38,
        "version": 1,
        "refresh": "30s",
        "time": {"from": "now-6h", "to": "now"},
        "timezone": "browser",
        "tags": ["tahti", "infrastructure", "vimage6"],
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "links": [
            {
                "title": "Tahti vital services",
                "url": "/d/tahti-vital-services",
                "type": "link",
            },
            {
                "title": "Tahti lab overview",
                "url": "/d/tahti-overview",
                "type": "link",
            },
        ],
        "templating": {
            "list": [
                {
                    "name": "host",
                    "type": "query",
                    "label": "Host",
                    "datasource": DS,
                    "query": 'label_values(up{job="node"}, instance)',
                    "refresh": 2,
                    "multi": True,
                    "includeAll": True,
                    "allValue": ".*",
                    "current": {},
                }
            ]
        },
        "panels": panels,
    }

    out = Path(__file__).with_name("tahti-infrastructure.json")
    out.write_text(json.dumps(dashboard, indent=2) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
