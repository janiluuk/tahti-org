#!/usr/bin/env python3
"""Replace the fleet-hosts block in vimage6 prometheus.yml."""
from __future__ import annotations

import sys
from pathlib import Path

START = "  # --- fleet-hosts (managed by tahti-org) ---"
END = "  # --- end fleet-hosts ---"


def main() -> None:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} prometheus.yml fleet.snippet.yml", file=sys.stderr)
        sys.exit(1)

    prom_path = Path(sys.argv[1])
    snippet = Path(sys.argv[2]).read_text().rstrip() + "\n"
    content = prom_path.read_text()

    if START in content:
        start_idx = content.index(START)
        if END in content:
            end_idx = content.index(END) + len(END)
            content = content[:start_idx] + snippet + content[end_idx:].lstrip("\n")
        else:
            content = content[:start_idx] + snippet
    else:
        # Insert fleet jobs after the self-scrape prometheus job.
        marker = "- job_name: prometheus\n"
        if marker not in content:
            raise SystemExit("prometheus self-scrape job not found")
        insert_at = content.index(marker)
        block_end = content.find("\n- job_name:", insert_at + len(marker))
        if block_end == -1:
            block_end = content.find("\n  # --- tahti-vital-services", insert_at)
        if block_end == -1:
            content = content.rstrip() + "\n" + snippet
        else:
            content = content[:block_end] + "\n" + snippet + content[block_end:]

    prom_path.write_text(content)


if __name__ == "__main__":
    main()
