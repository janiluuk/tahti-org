# Onboard tahti.local (192.168.2.107) into the fleet

Status: open — new dedicated box (lots of storage + RAM), not yet doing anything for Tahti.

## Context / decision

Production today is **not** the Swarm topology in `infra/docker-stack.yml` —
that file says so explicitly (it's "not actually deployed today"; kept for a
future migration). The real production stack is `infra/docker-compose.stack.yml`,
plain `docker compose` on a single host, **vimage** (192.168.2.100). The only
other machine already doing real work for Tahti is **vimage7** (192.168.2.187,
has a GPU), connected over LAN the same way: its own small compose project
(`infra/docker-compose.worker-remote.yml`) pointed at vimage's Postgres/Redis/
MinIO via env vars — see `infra/stack.env.worker-remote.example`.

**Recommendation: MinIO is the best use of this box**, using that same
remote-service-over-LAN pattern rather than a full Swarm migration:

- MinIO is pure object storage — network + disk I/O + a bit of CPU for
  erasure coding/checksums, **no GPU involved at all**. Nothing in this
  codebase's MinIO usage (`apps/api`, `apps/worker`, orchestrator) touches a
  GPU; the only GPU-bound thing in the whole fleet is `stem-separator`
  (UVR5 stem separation), which is why _that_ stays on vimage7. A normal
  Xeon with plenty of RAM/disk is exactly the right shape for a MinIO box —
  more disk and RAM (page cache) helps far more than any GPU would.
- This also matches the _already-documented target_ in
  `docs/scaling-node-distribution.md` (`role=storage` node, "vertical + disk,
  later distributed MinIO") and the `role=storage` constraint already
  written into `infra/docker-stack.yml` (line ~240) — tahti.local becoming
  the storage box is just executing that plan a step early, without waiting
  for the rest of the Swarm migration.
- Given the storage/RAM headroom, tahti.local could _also_ eventually take
  Postgres backup verification / restore-test duty (`ops/BACKUP.md`'s weekly
  `restore-test` currently needs "a throwaway DB" — this box has room for
  that without touching production) — worth a separate decision, not
  bundled into the MinIO move.

## Server hardware (found via SSH, 2026-09-15; device letters + a new SSD reconfirmed 2026-09-23 — see below)

```
OS:      Fedora Linux 44 Server, kernel 7.2.4-200.fc44.x86_64
CPU:     2× Intel Xeon E5-2640 v4 @ 2.40GHz (10c/20t each = 20c/40t total)
RAM:     62 GiB + 8 GiB zram swap
NIC:     eno1 1000Mb/s (only link up); eno2 down/unplugged
Storage: Adaptec Series 8 12G SAS/PCIe3 HBA/RAID controller (aacraid driver;
         arcconf CLI not installed) — currently passes disks through
         individually, not as assembled hardware RAID volumes

Docker 29.8.0 installed + active; ssh user `jani` not yet in the `docker`
group. Port 9090 already listening (process unknown — not identified this
session, check before assuming it's free for something else).
```

**2026-09-23 re-check: `/dev/sdX` letters have all shifted since the 2026-09-15
survey (boot disk moved sdc→sde), and a 6th disk now exists that wasn't there
before.** Always resolve by `/dev/disk/by-id/...` (below), never by the
`sdX` letter — a reboot or the next disk added/removed will shuffle them
again. Verified via `sudo -n` (scoped NOPASSWD sudoers, `/etc/sudoers.d/
tahti-local-onboarding`) with `mdadm --examine`, `blkid`, `file -s`,
`smartctl -H`:

| Current | by-id                                  | Size   | Role                    | State (2026-09-23)                                                                                                                                                                                                                   |
| ------- | -------------------------------------- | ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| sde     | (Kingston SHFS37A240G)                 | 223.6G | OS boot disk            | unchanged — sde1/2/3 (was sdc1/2/3), LVM `fedora` vg, `root` lv 15G, ~206G unallocated                                                                                                                                               |
| sda     | `ata-APPLE_SSD_SM0128G_S29BNYBGA94530` | 113G   | **New — fast/SATA SSD** | Free (empty GPT protective-MBR, zero partitions). SMART: PASSED. **Not NVMe** — no NVMe controller/`/dev/nvme*` exists on this box, despite the "nvme drive" request; this is the closest fast disk and is being used for that role. |
| sdc     | `scsi-35000c50093e799af`               | 1.1T   | MinIO pool (was sda)    | Free — no md superblock. SMART: OK                                                                                                                                                                                                   |
| sdf     | `scsi-35000cca01d342104`               | 1.1T   | MinIO pool (was sdd)    | Free — no md superblock. SMART: OK                                                                                                                                                                                                   |
| sdd     | `scsi-35000c50094179be3`               | 1.1T   | MinIO pool (was sdb)    | Stale Dell DDF RAID1E metadata (6-member, "Not Consistent") — not a live array, safe to `wipefs`. SMART: OK                                                                                                                          |
| sdg     | `scsi-3500003994813d615`               | 1.1T   | MinIO pool (was sde)    | Same stale Dell DDF RAID1E metadata as sdd. SMART: OK                                                                                                                                                                                |
| sdh     | `scsi-35000c50093eff5af`               | 1.1T   | MinIO pool (was sdf)    | Has `sdh1` (full-disk partition, `file -s` → unrecognized `data`, no fs signature) — no live filesystem. SMART: OK                                                                                                                   |

→ 5× ~1.1TiB 10K-RPM enterprise SAS disks (sdc/sdd/sdf/sdg/sdh, mixed
vendors — looks assembled from decommissioned/pulled drives, not a matched
set) for the MinIO pool, ~5.5 TiB raw, all confirmed free and healthy.
`sda` (113G SATA SSD) is the fast-storage disk for the restore-test LV /
local backup staging role below, in place of the boot SSD's spare VG space
— gives that role a fully separate physical disk from the OS, which is
strictly better isolation than carving into `fedora`'s VG.

All six non-boot disks cleared for use — proceed to "Partitioning scheme"
below.

## Partitioning scheme

**5× SAS disks (by-id: `scsi-35000c50093e799af`, `scsi-35000c50094179be3`,
`scsi-35000cca01d342104`, `scsi-3500003994813d615`, `scsi-35000c50093eff5af`
— currently sdc/sdd/sdf/sdg/sdh, see device table above) → MinIO's own
drives, not host RAID.** MinIO's own guidance for a single-node multi-drive
deployment is to hand it raw JBOD disks directly (XFS per disk, MinIO's
tested/recommended fs) and let MinIO's built-in erasure coding provide
redundancy — not to stack it on top of mdadm/hardware RAID, which just adds
a second, redundant redundancy layer and burns capacity twice. This also
matches what's already sitting here: the Adaptec card is in passthrough
mode exposing raw disks, not fused hardware volumes, so there's no RAID
layer to fight with.

- [x] Confirm the 5 SAS disks are free (see device table above, verified
      2026-09-23: no md superblock / stale non-assembled DDF metadata only /
      no fs signature; SMART OK on all).
- [x] 2026-09-23: Wiped stale signatures (`wipefs -a`) and formatted each
      XFS (no partition table — whole-disk paths, as MinIO expects).
- [x] 2026-09-23: Mounted all 5 by UUID in `/etc/fstab` (resolved once via
      `/dev/disk/by-id/...`, `blkid -s UUID`, since letters shift — see
      device table above) at `/mnt/minio/disk{1..5}` (`nofail`), `mount -a`
      verified. `sdc`→disk1, `sdd`→disk2, `sdf`→disk3, `sdg`→disk4,
      `sdh`→disk5 (today's letters — irrelevant now that fstab keys on
      UUID).
- [ ] Run MinIO as `minio server /mnt/minio/disk{1...5}` (single-node,
      multi-drive mode) — default erasure-coding parity for 5 drives
      tolerates 2 drive failures, ~3.3 TiB usable of the ~5.5 TiB raw. Bump
      to `MINIO_STORAGE_CLASS_STANDARD=EC:3` if 3-drive-failure tolerance is
      worth more than the capacity to you (recycled drives argue for the
      safer default, at least initially).
- [ ] **Boot SSD (sde) stays OS-only, not part of the MinIO pool.** Its
      ~206 GiB of unused `fedora` VG space still isn't idle-worthy —
      `lvextend` the `root` LV from 15G to something realistic for a
      Docker host (100 G+; 15G will fill up fast once MinIO tooling/logs
      land on it) — `lvextend -L +100G /dev/fedora/root && xfs_growfs /`.
- [x] **New fast SSD (`sda`, by-id `ata-APPLE_SSD_SM0128G_S29BNYBGA94530`,
      113G, confirmed free 2026-09-23) is the speed-sensitive volume**,
      in place of the earlier plan to carve it out of the boot SSD's VG —
      a dedicated physical disk is strictly better isolation. 2026-09-23:
      wiped, formatted XFS (whole-disk, no partition table), mounted by
      UUID at `/mnt/fast` in `/etc/fstab`, `mount -a` verified. Still open —
      decide and use it for: - the throwaway-DB volume for `ops/BACKUP.md`'s weekly `backup.sh
restore-test` job — fast SSD, physically separate from both the OS
      disk and the MinIO spinning-disk pool. - the local backup safety-net copy — see below.

## Backup scheme

The existing pipeline (`ops/BACKUP.md`) already does the right thing and
needs surprisingly little change — `scripts/backup.sh` never hardcodes
MinIO's location, it only uses a pre-configured `mc alias` named `tahti`.
Moving MinIO's physical bytes to tahti.local is mostly a re-point, not a
redesign:

- [ ] **Don't move Postgres** — only MinIO is moving per this plan, so
      `pg_dump` keeps running on vimage exactly as today; only the MinIO
      side of `backup.sh` changes source.
- [ ] Re-point the alias: `mc alias set tahti http://192.168.2.107:9000
<access> <secret>` wherever `backup.sh` runs (today: vimage, as the
      Swarm-manager-that-isn't-really-Swarm). No script/cron changes needed
      beyond this.
- [ ] Keep the **local safety-net copy physically separate from the MinIO
      pool it's backing up** — this is the exact lesson from the
      2026-08-13 incident write-up in `ops/BACKUP.md` (Docker volume wiped,
      no backup existed because the only copy lived on the same failure
      domain). On tahti.local that means the pg-dump-mirror / mc-mirror
      local target (`LOCAL_BACKUP_DIR` / `LOCAL_MIRROR_DIR` env overrides in
      `scripts/backup.sh`) should live on the **fast SSD** (`sda`, `/mnt/fast`
      — its own SATA port, separate disk entirely from both the boot SSD and
      the 5-disk MinIO pool), not on the MinIO pool itself and not a Docker
      volume — mirroring how `/share/disk2` on vimage today is deliberately
      a separate physical disk from MinIO's own volume.
- [ ] Existing off-host copy (rsync to vimage6) and offsite DR (`tahti-dr`
      UpCloud alias) need no logical changes — they already pull from
      whatever `SRC_ALIAS`/`tahti` alias resolves to. Just re-verify
      `tahti-dr` is actually provisioned (`ops/BACKUP.md` flagged it as
      "not yet provisioned as of 2026-08-16" — check whether that's still
      true before relying on it as the 3rd copy).
- [ ] Note the throughput ceiling: tahti.local's only active NIC is
      **1 GbE** (eno1; eno2 is unplugged/down) — fine for the existing
      ~24h RPO daily mirror cadence, but worth knowing before assuming a
      full-bucket restore or an initial `mc mirror` seed (multiple TB) will
      be fast. If eno2 gets plugged in later, bonding or a second dedicated
      link for backup traffic is an easy upgrade.
- [ ] Add tahti.local's disks to `ops/BACKUP.md`'s RPO/RTO table once the
      above is live (it currently only documents vimage's `/share/disk2`
      layout).

## MinIO migration checklist

- [x] 2026-09-23: Disk prep done (see "Partitioning scheme" above) — 5 SAS
      disks wiped/formatted/mounted at `/mnt/minio/disk{1..5}`, fast SSD at
      `/mnt/fast`. `jani` added to the `docker` group on tahti.local.
- [x] 2026-09-23: Stood up MinIO on tahti.local as its own small `docker
compose` project, mirroring `infra/docker-compose.worker-remote.yml`'s
      pattern — new `infra/docker-compose.minio-remote.yml` +
      `infra/stack.env.minio-remote.example` + `scripts/deploy_minio_remote.sh`
      (`--bootstrap-env` pulls `MINIO_SECRET_KEY` straight from vimage's live
      `infra/stack.env` over SSH so the secret never has to be typed/pasted
      anywhere — same credentials as the main stack, so this becomes a
      drop-in replacement once migrated, not a second identity). Reuses
      `quay.io/minio/minio:latest` (`docker.io/minio/minio` denies anonymous
      pulls as of 2026-09). Runs `minio server /data{1...5}` (single pool, 5
      drives) with the 5 host disks **bind-mounted** (`/mnt/minio/diskN:
/dataN`), not Docker-managed volumes — so the erasure-coded object
      files are directly browsable on the host filesystem with `ls`/`find`
      under `/mnt/minio/disk{1..5}`, same as vimage's own MinIO data would
      be if it weren't in a named volume. Deployed and verified: container
      healthy, `mc ready local` OK, `GET /minio/health/live` → 200,
      `.minio.sys` visible on all 5 disks. **Standalone instance only so
      far — not yet migrated from vimage or cut over** (see the two
      checklist items below).
- [ ] Migrate data with `mc mirror` (same tool `ops/BACKUP.md` already uses
      for the daily MinIO backup mirror) — `mc alias set` both old
      (`http://192.168.2.100:9000` internal, or the published `19000` lab
      port) and new (`http://192.168.2.107:9000`) endpoints, mirror bucket
      by bucket, diff-check counts before cutover (same 1% tolerance script
      already used for backup verification).
- [ ] Cut over: update `MINIO_ENDPOINT` / `MINIO_PUBLIC_ENDPOINT` in
      vimage's `infra/stack.env` (and `infra/stack.env.worker-remote` for
      vimage7's `worker-transcode`) to point at tahti.local. Restart
      `api`, `worker*`, `orchestrator` so they pick up the new endpoint.
      Keep the old vimage MinIO container stopped-but-present for a rollback
      window before deleting its volume.
- [ ] Point the existing DR mirror (`ops/BACKUP.md` → `tahti-dr` UpCloud
      alias) at the new source instead of vimage's local MinIO.
- [ ] Update docs that hardcode the old assumption:
      `docs/scaling-node-distribution.md`, `ops/ARCHITECTURE.md` (storage
      node is no longer "the same box as everything else"),
      `ops/monitoring/vimage6/README.md`'s lab stack port table if the LAN
      port changes.
- [ ] Decide whether tahti.local joins a real Swarm cluster later
      (`docker swarm init` on a manager, `docker node update --label-add
role=storage tahti-local` — see `infra/docker-stack.yml` header
      comment) or stays a single remote-compose box indefinitely, same as
      vimage7 today. Not blocking the MinIO move either way.

## Monitoring onboarding checklist (tahti.local → all dashboards)

Monitoring (Prometheus + Grafana) runs on **vimage6** (192.168.2.105),
managed by `ops/monitoring/vimage6/` + its `deploy.sh`. Per-host OS/container
metrics (`node_exporter`, `cAdvisor`, a custom `docker-catalog` job) for
`vimage, vimage2–vimage5, vimage6, vimage7, pi4, pi5, web` are scraped by
jobs that already exist directly in vimage6's own `prometheus.yml` — **not**
managed by this repo's `prometheus-tahti.snippet.yml`, so some of this is a
manual step on vimage6 itself, not a code change here.

- [x] 2026-09-23: Installed `node_exporter`, `cAdvisor`, and the
      `docker-catalog` exporter on tahti.local (same run config as vimage's:
      host network + host PID for node-exporter; exporter script + empty
      `url-overrides.json` copied to `~/monitoring/` since `/opt` needs root
      and the sudoers scope doesn't cover arbitrary `mkdir`). Confirmed
      `:9100`/`:8081`/`:9096` all serving metrics locally, `docker-catalog`
      already discovering the `minio` container correctly.
- [x] 2026-09-23: Added `192.168.2.107` (`tahti-local`) as a target + a
      relabel block (`instance`/`host_ip`) to the `node`, `cadvisor`, and
      `docker-catalog` jobs directly in vimage6's live `prometheus.yml`
      (manual edit, outside the managed snippet — confirmed the diff
      touched nothing else, validated with `promtool check config` before
      `curl -X POST :9090/-/reload`).
- [x] 2026-09-23: firewalld on tahti.local was blocking all of this from
      LAN (targets showed `down` until opened) — added `9100/8081/9096`
      (exporters) and `9000/9001` (MinIO S3/console) via
      `firewall-cmd --permanent --add-port` + `--reload`. Not in the
      original checklist; worth remembering for any future service added
      on this host.
- [x] 2026-09-23: Added `tahti-local` to `HOSTS` in
      `ops/monitoring/vimage6/generate-tahti-infrastructure-dashboard.py`
      and regenerated `tahti-infrastructure.json`. Puts the host into every
      CPU/load/memory/disk/network panel on the **Tahti — infrastructure &
      services** dashboard.
- [x] 2026-09-23: Added a blackbox probe for tahti.local's MinIO
      (`http://192.168.2.107:9000/minio/health/live`, `host: tahti-local`
      label, own `static_configs` entry alongside vimage's existing MinIO
      probe in the same `tahti_blackbox` job) to
      `ops/monitoring/vimage6/prometheus-tahti.snippet.yml`.
- [ ] tahti.local doesn't host a worker (MinIO only) — the "Worker nodes"
      panel regex (`instance=~"vimage|vimage4|vimage7"`,
      `generate-tahti-infrastructure-dashboard.py` ~line 755) is correctly
      left alone; revisit only if a worker is ever added here.
- [x] 2026-09-23: Redeployed via `./ops/monitoring/vimage6/deploy.sh` —
      `promtool check config` passed, Prometheus + Grafana both reloaded
      without restart, no errors.
- [x] 2026-09-23: Verified via Prometheus's own `/api/v1/targets` (not yet
      visually confirmed in the Grafana UI): `node`/`cadvisor`/
      `docker-catalog`/`tahti_blackbox` all report `health: up` for
      `tahti-local`. **Still open:** eyeball the actual Grafana panels
      (`http://192.168.2.105:3000` → Tahti — infrastructure & services) to
      confirm the host renders correctly, not just that Prometheus scrapes
      it.
- [ ] Update `ops/monitoring/vimage6/README.md`'s host list line ("Existing
      Prometheus jobs on vimage6 already scrape... on: `vimage, vimage2–
vimage5, vimage6, pi4, pi5, web`") to include tahti.local/vimage7 (that
      line is already stale re: vimage7 — worth fixing both at once).
- [ ] Vital-metrics panels for tahti.local specifically: confirm `node`/
      `cadvisor` scrape gives disk **used space** (not just up/down — the
      5-disk MinIO pool + fast SSD + boot SSD each need their own
      `node_filesystem_avail_bytes`/`node_filesystem_size_bytes` series, not
      just the root fs), CPU/RAM **utilization**, **disk I/O**
      (`node_disk_read/write_bytes_total` per `/mnt/minio/diskN` +
      `/mnt/fast`), and **network I/O** (`node_network_receive/transmit_
bytes_total` on `eno1`) — the generated infra dashboard already has generic
      per-host panels for these; verify tahti.local's 6 extra block devices
      actually show up distinctly (by-id label, not just `sdX`, since those
      letters are known to shift — see device table above) rather than
      collapsing into one generic "disk" series.

## Dozzle (container log viewer)

Dozzle (`infra/docker-compose.stack.yml`'s `dozzle` service, on vimage) only
reads the **local** Docker socket, filtered to
`label=com.docker.compose.project=tahti-stack` — it currently shows nothing
from any remote host, including vimage7's already-running
`worker-transcode`/`stem-separator` (this is a pre-existing gap, not new to
tahti.local). Dozzle supports multi-host log aggregation via its **agent**
mode (`amir20/dozzle:v11.0.0 agent` sub-command, a small container run on
the remote host that the main Dozzle instance connects to over
`DOZZLE_REMOTE_AGENT`) — that's the mechanism to use here, not a shared/
exposed Docker socket over the network.

- [ ] Run a `dozzle agent` container on tahti.local (same image/version
      pinned as vimage's `dozzle` service, `amir20/dozzle:v11.0.0`) —
      likely belongs in `infra/docker-compose.minio-remote.yml` itself so it
      starts/stops with the rest of that host's stack, or vimage7's
      `docker-compose.worker-remote.yml` gets the same treatment first if
      this is being done as a general pattern rather than a one-off.
- [ ] On vimage: add `DOZZLE_REMOTE_AGENT=192.168.2.107:7007` (default
      agent port) to the `dozzle` service's environment in
      `infra/docker-compose.stack.yml`, restart it.
- [ ] Verify in the Dozzle UI (`http://192.168.2.100:18090` or wherever it's
      published) that tahti.local's `minio` container's logs show up
      alongside the main stack's containers.
- [ ] Since this closes a real existing gap, do the same for vimage7's
      `worker-transcode`/`stem-separator` while in this code, not just
      tahti.local — otherwise this ships as another one-host-only fix.
