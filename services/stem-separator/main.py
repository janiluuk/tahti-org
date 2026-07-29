# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# UVR5-family vocal/instrument separation, exposed as a small internal HTTP
# service so the (Node) worker doesn't need a Python/torch runtime of its
# own. Stateless: takes one audio file + a stem set, returns a zip of the
# separated stems. Models are baked into the image at build time (see
# Dockerfile) so a request never blocks on a first-run model download.

import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from audio_separator.separator import Separator

app = FastAPI(title="tahti-stem-separator")

MODEL_TWO_STEM = os.environ.get(
    "STEM_MODEL_TWO_STEM", "model_bs_roformer_ep_317_sdr_12.9755.ckpt"
)
MODEL_FOUR_STEM = os.environ.get("STEM_MODEL_FOUR_STEM", "htdemucs_ft.yaml")
MODEL_DIR = os.environ.get("STEM_MODEL_DIR", "/models")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/separate")
async def separate(file: UploadFile = File(...), stem_set: str = Form(...)):
    if stem_set not in ("TWO_STEM", "FOUR_STEM"):
        raise HTTPException(400, "stem_set must be TWO_STEM or FOUR_STEM")

    work_dir = tempfile.mkdtemp(prefix="tahti-stems-")
    try:
        input_path = Path(work_dir) / (file.filename or "input.audio")
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        output_dir = Path(work_dir) / "output"
        output_dir.mkdir()

        separator = Separator(
            output_dir=str(output_dir),
            model_file_dir=MODEL_DIR,
            output_format="FLAC",
        )
        model = MODEL_TWO_STEM if stem_set == "TWO_STEM" else MODEL_FOUR_STEM
        separator.load_model(model_filename=model)

        try:
            output_files = separator.separate(str(input_path))
        except Exception as exc:  # noqa: BLE001 - report to caller, don't crash the service
            raise HTTPException(500, f"separation failed: {exc}") from exc

        if not output_files:
            raise HTTPException(500, "separation produced no output files")

        zip_path = Path(tempfile.mkdtemp(prefix="tahti-stems-zip-")) / "stems.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
            for output_file in output_files:
                zf.write(output_file, arcname=Path(output_file).name)

        return FileResponse(
            str(zip_path),
            media_type="application/zip",
            filename="stems.zip",
            background=BackgroundTask(lambda: shutil.rmtree(zip_path.parent, ignore_errors=True)),
        )
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
