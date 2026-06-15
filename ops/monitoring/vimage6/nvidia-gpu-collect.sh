#!/usr/bin/env bash
# Write nvidia-smi stats to /opt/nvidia-metrics/nvidia.prom for node_exporter textfile collector.
set -euo pipefail

OUT_DIR="${NVIDIA_METRICS_DIR:-/opt/nvidia-metrics}"
OUT_FILE="${OUT_DIR}/nvidia.prom"
TMP_FILE="${OUT_DIR}/nvidia.prom.tmp"

mkdir -p "${OUT_DIR}"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  exit 0
fi

nvidia-smi \
  --query-gpu=index,name,utilization.gpu,utilization.memory,memory.total,memory.used,temperature.gpu,power.draw \
  --format=csv,noheader,nounits 2>/dev/null |
  awk -F', ' '
function num(v,    x) {
  gsub(/^\[|\]$/, "", v)
  if (v == "" || v == "N/A" || v == "[N/A]") return "nan"
  return v + 0
}
{
  i = $1
  n = $2
  gsub(/ /, "_", n)
  util = num($3)
  mem_used = num($6)
  mem_total = num($5)
  temp = num($7)
  power = num($8)
  if (util != "nan")
    printf "nvidia_gpu_utilization_ratio{gpu=\"%s\",name=\"%s\"} %.4f\n", i, n, util / 100
  if (mem_used != "nan")
    printf "nvidia_gpu_memory_used_bytes{gpu=\"%s\",name=\"%s\"} %.0f\n", i, n, mem_used * 1024 * 1024
  if (mem_total != "nan")
    printf "nvidia_gpu_memory_total_bytes{gpu=\"%s\",name=\"%s\"} %.0f\n", i, n, mem_total * 1024 * 1024
  if (temp != "nan")
    printf "nvidia_gpu_temperature_celsius{gpu=\"%s\",name=\"%s\"} %.1f\n", i, n, temp
  if (power != "nan")
    printf "nvidia_gpu_power_draw_watts{gpu=\"%s\",name=\"%s\"} %.2f\n", i, n, power
}' >"${TMP_FILE}"

if [[ -s "${TMP_FILE}" ]]; then
  mv "${TMP_FILE}" "${OUT_FILE}"
else
  rm -f "${TMP_FILE}"
fi
