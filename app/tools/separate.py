#!/usr/bin/env python3
"""Tone Zone stem separation (Demucs).

usage:
  separate.py --check
  separate.py --in mix.wav --out DIR [--model htdemucs_6s] [--device auto|cpu|cuda] [--shifts 1] [--split-guitar]

Writes one float WAV per stem into DIR and prints progress lines ("PROGRESS <0..100> <stage>") and a final
"RESULT {json}" line. --split-guitar additionally writes guitar_lead.wav / guitar_rhythm.wav, an *estimate* made by
splitting the guitar stem by stereo position (centred parts vs. panned parts) in the STFT domain.
"""
import argparse, json, os, sys, time


def emit(p, stage):
    print(f"PROGRESS {p:.1f} {stage}", flush=True)


def check():
    out = {"python": sys.version.split()[0]}
    try:
        import torch
        out["torch"] = torch.__version__
        out["cuda"] = bool(torch.cuda.is_available())
        out["device"] = torch.cuda.get_device_name(0) if out["cuda"] else "cpu"
    except Exception as e:  # noqa
        out["torch_error"] = str(e)
    try:
        import demucs
        out["demucs"] = getattr(demucs, "__version__", "?")
    except Exception as e:  # noqa
        out["demucs_error"] = str(e)
    try:
        import soundfile  # noqa
        out["soundfile"] = True
    except Exception as e:  # noqa
        out["soundfile_error"] = str(e)
    print("RESULT " + json.dumps(out), flush=True)


class TqdmToProgress:
    """Captures Demucs' tqdm progress (written to stderr) and re-emits it as PROGRESS lines."""

    def __init__(self, lo, hi, stage):
        self.lo, self.hi, self.stage, self.last = lo, hi, stage, -1

    def write(self, s):
        import re
        m = re.findall(r"(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)", s)
        if m:
            a, b = float(m[-1][0]), float(m[-1][1])
            if b > 0:
                p = self.lo + (self.hi - self.lo) * min(1.0, a / b)
                if p - self.last >= 1:
                    self.last = p
                    emit(p, self.stage)

    def flush(self):
        pass


def split_guitar(gtr, sr):
    """gtr: tensor (2, T). Returns (lead, rhythm) stereo tensors via per-bin pan analysis."""
    import torch
    n_fft, hop = 4096, 1024
    win = torch.hann_window(n_fft)
    L = torch.stft(gtr[0], n_fft, hop, window=win, return_complex=True)
    R = torch.stft(gtr[1], n_fft, hop, window=win, return_complex=True)
    aL, aR = L.abs(), R.abs()
    pan = (aL - aR) / (aL + aR + 1e-9)
    # soft mask: centred bins -> lead, panned bins -> rhythm
    centre = torch.clamp(1.0 - pan.abs() / 0.35, 0.0, 1.0)
    lead = torch.stack([torch.istft(L * centre, n_fft, hop, window=win, length=gtr.shape[1]), torch.istft(R * centre, n_fft, hop, window=win, length=gtr.shape[1])])
    rhythm = gtr - lead
    return lead, rhythm


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--in", dest="inp")
    ap.add_argument("--out")
    ap.add_argument("--model", default="htdemucs_6s")
    ap.add_argument("--device", default="auto")
    ap.add_argument("--shifts", type=int, default=1)
    ap.add_argument("--split-guitar", action="store_true")
    a = ap.parse_args()
    if a.check:
        return check()
    import numpy as np
    import soundfile as sf
    import torch
    import torchaudio.functional as AF
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    os.makedirs(a.out, exist_ok=True)
    emit(1, "loading audio")
    data, sr = sf.read(a.inp, dtype="float32", always_2d=True)
    wav = torch.from_numpy(data.T.copy())
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    wav = wav[:2]
    emit(3, "loading model (first run downloads it)")
    if os.environ.get("TZ_SEPARATE_TEST_RANDOM"):  # test hook: untrained 6-stem model (no download)
        from demucs.htdemucs import HTDemucs
        model = HTDemucs(sources=["drums", "bass", "other", "vocals", "guitar", "piano"], channels=8, t_layers=1, segment=4)
    else:
        model = get_model(a.model)
    model.eval()
    dev = "cuda" if (a.device in ("auto", "cuda") and torch.cuda.is_available()) else "cpu"
    if sr != model.samplerate:
        wav = AF.resample(wav, sr, model.samplerate)
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    x = (wav - mean) / std
    emit(8, f"separating on {dev}")
    t0 = time.time()
    old = sys.stderr
    sys.stderr = TqdmToProgress(8, 92, "separating")
    try:
        with torch.no_grad():
            out = apply_model(model, x[None], shifts=a.shifts, split=True, overlap=0.25, progress=True, device=dev)[0]
    finally:
        sys.stderr = old
    out = out * std + mean
    stems = {}
    for name, s in zip(model.sources, out):
        s = s.cpu()
        if model.samplerate != sr:
            s = AF.resample(s, model.samplerate, sr)
        p = os.path.join(a.out, f"{name}.wav")
        sf.write(p, s.numpy().T, sr, subtype="FLOAT")
        stems[name] = p
    if a.split_guitar and "guitar" in stems:
        emit(95, "splitting guitar (lead / rhythm estimate)")
        g, _ = sf.read(stems["guitar"], dtype="float32", always_2d=True)
        lead, rhythm = split_guitar(torch.from_numpy(g.T.copy()), sr)
        for nm, s in (("guitar_lead", lead), ("guitar_rhythm", rhythm)):
            p = os.path.join(a.out, f"{nm}.wav")
            sf.write(p, s.numpy().T, sr, subtype="FLOAT")
            stems[nm] = p
    emit(100, f"done in {time.time() - t0:.0f}s")
    print("RESULT " + json.dumps({"stems": stems, "sr": sr, "device": dev, "model": a.model}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa
        import traceback
        traceback.print_exc()
        print("ERROR " + str(e), flush=True)
        sys.exit(1)
