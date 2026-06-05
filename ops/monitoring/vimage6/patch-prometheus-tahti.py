#!/usr/bin/env python3
"""Replace the tahti-vital-services block in vimage6 prometheus.yml."""
from __future__ import annotations

import sys
from pathlib import Path

START = "  # --- tahti-vital-services (managed by tahti-org) ---"
END = "  # --- end tahti-vital-services ---"
RULES_MARKER = "tahti-alert-rules (managed by tahti-org)"


def main() -> None:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} prometheus.yml snippet.yml", file=sys.stderr)
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
        content = content.rstrip() + "\n\n" + snippet

    if RULES_MARKER not in content:
        rules_block = (
            f"\nrule_files:\n"
            f"  - rules/prometheus-tahti-alerts.yml  # {RULES_MARKER}\n"
        )
        if "rule_files:" not in content:
            if "scrape_configs:" in content:
                content = content.replace(
                    "scrape_configs:",
                    rules_block + "scrape_configs:",
                    1,
                )
            else:
                content = content.rstrip() + rules_block
        elif "rules/prometheus-tahti-alerts.yml" not in content:
            content = content.replace(
                "rule_files:",
                f"rule_files:\n  - rules/prometheus-tahti-alerts.yml  # {RULES_MARKER}",
                1,
            )

    prom_path.write_text(content)


if __name__ == "__main__":
    main()
