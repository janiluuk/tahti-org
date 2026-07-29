# syntax=docker/dockerfile:1
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# CPU-only (no GPU in colo/Hetzner — see hosting-decisions). Models are
# downloaded and baked in at build time so a running container never blocks
# on a first-request download; this makes the image large (~3-5GB with
# torch + two model checkpoints) and the build slow the first time.
#
# Build from repo root:
#   docker build -f services/stem-separator/Dockerfile -t tahti/stem-separator .

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg libsndfile1 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/stem-separator/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

ENV STEM_MODEL_DIR=/models
ENV STEM_MODEL_TWO_STEM=model_bs_roformer_ep_317_sdr_12.9755.ckpt
ENV STEM_MODEL_FOUR_STEM=htdemucs_ft.yaml

# Bake both models into the image so containers never download on request.
RUN python -c "\
import os; \
from audio_separator.separator import Separator; \
s = Separator(model_file_dir=os.environ['STEM_MODEL_DIR']); \
s.load_model(model_filename=os.environ['STEM_MODEL_TWO_STEM']); \
s2 = Separator(model_file_dir=os.environ['STEM_MODEL_DIR']); \
s2.load_model(model_filename=os.environ['STEM_MODEL_FOUR_STEM'])"

COPY services/stem-separator/main.py ./

EXPOSE 8090
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
