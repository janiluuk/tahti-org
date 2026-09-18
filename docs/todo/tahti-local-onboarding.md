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
  (UVR5 stem separation), which is why *that* stays on vimage7. A normal
  Xeon with plenty of RAM/disk is exactly the right shape for a MinIO box —
  more disk and RAM (page cache) helps far more than any GPU would.
- This also matches the *already-documented target* in
  `docs/scaling-node-distribution.md` (`role=storage` node, "vertical + disk,
  later distributed MinIO") and the `role=storage` constraint already
  written into `infra/docker-stack.yml` (line ~240) — tahti.local becoming
  the storage box is just executing that plan a step early, without waiting
  for the rest of the Swarm migration.
- Given the storage/RAM headroom, tahti.local could *also* eventually take
  Postgres backup verification / restore-test duty (`ops/BACKUP.md`'s weekly
  `restore-test` currently needs "a throwaway DB" — this box has room for
  that without touching production) — worth a separate decision, not
  bundled into the MinIO move.

## Server hardware (found via SSH, 2026-09-15)

```
OS:      Fedora Linux 44 Server, kernel 7.2.4-200.fc44.x86_64
CPU:     2× Intel Xeon E5-2640 v4 @ 2.40GHz (10c/20t each = 20c/40t total)
RAM:     62 GiB + 8 GiB zram swap
NIC:     eno1 1000Mb/s (only link up); eno2 down/unplugged
Storage: Adaptec Series 8 12G SAS/PCIe3 HBA/RAID controller (aacraid driver;
         arcconf CLI not installed) — currently passes disks through
         individually, not as assembled hardware RAID volumes

  sdc  223.6G  Kingston SHFS37A240G (SSD, OS boot disk)
       sdc1  600M  vfat  /boot/efi
       sdc2    2G  xfs   /boot
       sdc3  221G  LVM2_member → vg "fedora" → lv "root" 15G xfs on /
       → ~206 GiB UNALLOCATED free space still sitting in the "fedora" VG

  sda   1.1T  Seagate EG1200JEMDA        — no fs/partition (raw)
  sdb   1.1T  Seagate ST1200MM0088       — FSTYPE=ddf_raid_member (stale RAID
                                           metadata, not currently assembled)
  sdd   1.1T  HGST HUC101212CSS600       — no fs/partition (raw)
  sde   1.1T  Toshiba AL15SEB120N        — FSTYPE=ddf_raid_member (stale)
  sdf   1.1T  Seagate ST1200MM0088       — sdf1: full-disk partition, no
                                           recognized fs/mountpoint

  → 5× ~1.1TiB 10K-RPM enterprise SAS disks (mixed vendors — looks
    assembled from decommissioned/pulled drives, not a matched set),
    ~5.5 TiB raw.

Docker 29.8.0 installed + active; ssh user `jani` not yet in the `docker`
group. Port 9090 already listening (process unknown — not identified this
session, check before assuming it's free for something else).
```

**Before touching sdb/sde/sdf: confirm they're actually free.** `sdb` and
`sde` carry leftover DDF RAID metadata (likely from this same Adaptec
controller's previous life) and `sdf1` has an existing partition with no
filesystem this session could identify without `sudo` (password-protected,
not available non-interactively here). Don't assume these are safe to wipe
without checking `sudo mdadm --examine /dev/sdb /dev/sde` and `sudo blkid
/dev/sdf1` / `sudo file -s /dev/sdf1` first — if they turn out to hold real
data from wherever these disks came from, that changes the plan. SMART
health (`smartctl -a`) is also unchecked — these are recycled 10K SAS
drives of unknown run-hours; check before trusting them with primary data.

## Partitioning scheme

**5× SAS disks (sda/sdb/sdd/sde/sdf) → MinIO's own drives, not host RAID.**
MinIO's own guidance for a single-node multi-drive deployment is to hand it
raw JBOD disks directly (XFS per disk, MinIO's tested/recommended fs) and
let MinIO's built-in erasure coding provide redundancy — not to stack it on
top of mdadm/hardware RAID, which just adds a second, redundant redundancy
layer and burns capacity twice. This also matches what's already sitting
here: the Adaptec card is in passthrough mode exposing 5 raw disks, not
fused hardware volumes, so there's no RAID layer to fight with.

- [ ] Confirm sda/sdb/sdd/sde/sdf are free (see checklist above), then wipe
      stale signatures (`wipefs -a`) and format each XFS, no partition table
      needed (MinIO can take whole-disk paths).
- [ ] Mount all 5 by **stable `/dev/disk/by-id/...` path**, not `/dev/sdX`
      (SCSI device letters aren't guaranteed to stay assigned the same way
      across reboots on a multi-disk HBA) — e.g. `/mnt/minio/disk{1..5}` in
      `/etc/fstab`.
- [ ] Run MinIO as `minio server /mnt/minio/disk{1...5}` (single-node,
      multi-drive mode) — default erasure-coding parity for 5 drives
      tolerates 2 drive failures, ~3.3 TiB usable of the ~5.5 TiB raw. Bump
      to `MINIO_STORAGE_CLASS_STANDARD=EC:3` if 3-drive-failure tolerance is
      worth more than the capacity to you (recycled drives argue for the
      safer default, at least initially).
- [ ] **SSD (sdc) stays OS-only, not part of the MinIO pool** — but its
      ~206 GiB of unused VG space shouldn't sit idle either:
      - `lvextend` the `root` LV from 15G to something realistic for a
        Docker host (100 G+; 15G will fill up fast once Postgres
        restore-test images / MinIO tooling / logs land on it) —
        `lvextend -L +100G /dev/fedora/root && xfs_growfs /`.
      - Carve a second LV (`lvcreate -L 50G -n restore-test fedora`) as the
        throwaway-DB volume for `ops/BACKUP.md`'s weekly `backup.sh
        restore-test` job — fast SSD, physically separate from the MinIO
        spinning-disk pool, good fit for that duty per the earlier
        "tahti.local could also take restore-test" note above.
      - Whatever's left over is the natural home for the local backup
        safety-net copy — see below.

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
      `scripts/backup.sh`) should live on the **SSD** (sdc, its own
      controller port, separate disks entirely from the 5-disk MinIO pool),
      not on the MinIO pool itself and not a Docker volume — mirroring how
      `/share/disk2` on vimage today is deliberately a separate physical
      disk from MinIO's own volume.
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

- [ ] Do the disk prep in "Partitioning scheme" above first (wipe/format
      the 5 SAS disks, mount by `by-id` path).
- [ ] Stand up MinIO on tahti.local as its own small `docker compose`
      project (mirror `infra/docker-compose.worker-remote.yml`'s pattern:
      own compose file, own `stack.env`, connects back to vimage over LAN),
      pointed at the 5 mounted disks (`minio server /mnt/minio/disk{1...5}`).
      Reuse the existing `quay.io/minio/minio:latest` image (see
      `infra/docker-stack.yml` — `docker.io/minio/minio` denies anonymous
      pulls as of 2026-09).
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

- [ ] Install/run `node_exporter` and `cAdvisor` on tahti.local (same as the
      other `vimageN` boxes — check vimage's own install for the exact
      compose/systemd setup to copy).
- [ ] Install/run whatever the `docker-catalog` exporter is on tahti.local
      too (it's not vendored in this repo — find its source/install method
      on an existing host, likely vimage6 itself or vimage).
- [ ] On vimage6: add `tahti.local` (or its chosen instance label, e.g.
      `tahti-local`) as a scrape target under the existing `node`,
      `cadvisor`, and `docker-catalog` jobs in vimage6's `prometheus.yml`
      (manual edit on the host — outside this repo's managed snippet).
- [ ] In this repo: add the new instance label to `HOSTS` in
      `ops/monitoring/vimage6/generate-tahti-infrastructure-dashboard.py`
      (currently `"vimage|vimage2|vimage3|vimage4|vimage5|vimage6|vimage7|
      pi4|pi5|web"`), then regenerate:
      `python3 ops/monitoring/vimage6/generate-tahti-infrastructure-dashboard.py`
      This alone puts the new host into every CPU/load/memory/disk/network
      panel on the **Tahti — infrastructure & services** dashboard.
- [ ] Once MinIO (or anything else) actually runs on tahti.local, add
      matching blackbox probes to
      `ops/monitoring/vimage6/prometheus-tahti.snippet.yml`'s
      `tahti_blackbox` job — mirror the existing vimage MinIO probe
      (`http://192.168.2.100:19000/minio/health/live` → add a
      `http://192.168.2.107:9000/minio/health/live` entry with `host:
      tahti-local` label), same for any other exposed health endpoint.
- [ ] If tahti.local hosts a worker (transcode/backup-verify/etc. — see
      decision above), add it to the "Worker nodes" panel query in
      `generate-tahti-infrastructure-dashboard.py`
      (`instance=~"vimage|vimage4|vimage7"` around line ~755 — extend the
      regex).
- [ ] Redeploy: `./ops/monitoring/vimage6/deploy.sh` (regenerates +
      scp's + patches vimage6's Prometheus config + reloads).
- [ ] Verify in Grafana (`http://192.168.2.105:3000` or
      `https://grafana.tahti.live`) → **Tahti — infrastructure & services**:
      tahti.local shows up in every host-scoped panel, `up{instance="..."}
      == 1` for `node`/`cadvisor`/`docker-catalog`.
- [ ] Update `ops/monitoring/vimage6/README.md`'s host list line ("Existing
      Prometheus jobs on vimage6 already scrape... on: `vimage, vimage2–
      vimage5, vimage6, pi4, pi5, web`") to include tahti.local/vimage7 (that
      line is already stale re: vimage7 — worth fixing both at once).
