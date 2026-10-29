#!/usr/bin/env python3
# Tone Zone capture trainer. Runs the NAM simplified trainer (neural-amp-modeler 0.13) on a rendered
# (input, output) pair and prints progress as "TZ {json}" lines for the app to read.
import argparse
import json
import os
import sys
import time
import types


def emit(**kw):
    print("TZ " + json.dumps(kw), flush=True)


# Classic NAM sizes (A1). Same networks the 0.12 trainer used, written in the 0.13 config format.
def a1_config(arch):
    c1, c2 = {"standard": (16, 8), "lite": (12, 6), "feather": (8, 4), "nano": (4, 2)}[arch]
    full = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
    if arch == "standard":
        d1, d2 = full, full
    else:
        d1, d2 = [1, 2, 4, 8, 16, 32, 64], [128, 256, 512] + full
    layer = lambda inp, ch, dil, head, bias: {
        "input_size": inp,
        "condition_size": 1,
        "channels": ch,
        "kernel_size": 3,
        "dilations": dil,
        "activation": "Tanh",
        "head": {"out_channels": head, "kernel_size": 1, "bias": bias},
    }
    return {
        "net": {
            "name": "WaveNet",
            "config": {
                "layers_configs": [layer(1, c1, d1, c2, False), layer(c1, c2, d2, 1, True)],
                "head_scale": 0.02,
            },
        },
        "loss": {"val_loss": "esr", "pre_emph_mrstft_weight": 2.0e-4, "pre_emph_mrstft_coef": 0.85},
        "optimizer": {"lr": 0.004},
        "lr_scheduler": {"class": "ExponentialLR", "kwargs": {"gamma": 0.993}},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--basename", default="model")
    ap.add_argument("--name", default="")
    ap.add_argument("--arch", default="a2", choices=["a2", "standard", "lite", "feather", "nano"])
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--stop-file", default="")
    ap.add_argument("--gear-type", default="")
    ap.add_argument("--tone-type", default="")
    ap.add_argument("--ignore-checks", action="store_true")
    ap.add_argument("--check", action="store_true", help="only report what is installed")
    a = ap.parse_args()

    os.environ.setdefault("MPLBACKEND", "Agg")
    # nam.train.core imports tkinter for its pop-ups; we never show one, so a stub is enough
    try:
        import tkinter  # noqa: F401
    except Exception:
        sys.modules["tkinter"] = types.ModuleType("tkinter")

    emit(type="stage", stage="loading")
    import torch
    import pytorch_lightning as pl
    import nam
    from nam.train import core
    from nam.models.metadata import GearType, ToneType, UserMetadata
    from nam.train.metadata import TRAINING_KEY

    gpu = torch.cuda.is_available()
    if a.check:
        emit(type="check", nam=nam.__version__, torch=torch.__version__, gpu=gpu,
             device=torch.cuda.get_device_name(0) if gpu else "CPU")
        return 0
    if a.threads > 0:
        torch.set_num_threads(a.threads)
    emit(type="stage", stage="device", gpu=gpu, device=torch.cuda.get_device_name(0) if gpu else "CPU")

    stop_file = a.stop_file

    class Progress(pl.Callback):
        def __init__(self):
            self.t0 = time.time()

        def on_train_epoch_start(self, trainer, module):
            self.t0 = time.time()

        def on_train_batch_end(self, trainer, module, outputs, batch, batch_idx):
            n = trainer.num_training_batches
            if batch_idx % max(1, int(n) // 25 if n != float("inf") else 10) == 0:
                emit(type="batch", epoch=trainer.current_epoch, batch=batch_idx + 1, batches=n)
            if stop_file and os.path.exists(stop_file):
                trainer.should_stop = True

        def on_validation_epoch_end(self, trainer, module):
            if trainer.sanity_checking:
                return
            m = {k: float(v) for k, v in trainer.callback_metrics.items() if getattr(v, "numel", lambda: 1)() == 1}
            packed = sorted(k for k in m if k.startswith("ESR_packed_"))
            esr = m[packed[-1]] if packed else m.get("ESR")
            emit(type="epoch", epoch=trainer.current_epoch + 1, epochs=trainer.max_epochs, esr=esr,
                 esrs=[m[k] for k in packed] if packed else None, secs=time.time() - self.t0)

    # add our progress callback to the trainer's own
    orig_callbacks = core.get_callbacks

    def get_callbacks(*args, **kw):
        return orig_callbacks(*args, **kw) + [Progress()]

    core.get_callbacks = get_callbacks

    # pick the network and quiet the console progress bar
    orig_configs = core._get_configs

    def get_configs(*args, **kw):
        data_config, model_config, learning_config = orig_configs(*args, **kw)
        if a.arch != "a2":
            model_config = a1_config(a.arch)
        learning_config["trainer"]["enable_progress_bar"] = False
        return data_config, model_config, learning_config

    core._get_configs = get_configs

    # the final accuracy check, without matplotlib plots
    def plot(model, ds, window_start=None, window_end=None, filepath=None, silent=False):
        net = getattr(model, "net", model)
        with torch.no_grad():
            out = model(ds.x).cpu().numpy()
        if out.ndim == 3 and out.shape[0] == 1:
            out = out[0]
        if out.ndim == 2 and out.shape[0] > 1:
            esrs = [core._esr(torch.Tensor(o), ds.y) for o in out]
            emit(type="esr", esr=esrs[-1], esrs=esrs, names=list(getattr(net, "submodel_names", ())))
            return sum(esrs)
        esr = core._esr(torch.Tensor(out.flatten()), ds.y)
        emit(type="esr", esr=esr, esrs=[esr])
        return esr

    core._plot = plot

    meta = UserMetadata(
        name=a.name or None,
        modeled_by="Tone Zone",
        gear_type=GearType(a.gear_type) if a.gear_type else None,
        tone_type=ToneType(a.tone_type) if a.tone_type else None,
    )
    emit(type="stage", stage="checks")
    try:
        out = core.train(
            a.input,
            a.output,
            a.outdir,
            epochs=a.epochs,
            silent=True,
            save_plot=False,
            modelname=a.basename,
            ignore_checks=a.ignore_checks,
            local=False,
            user_metadata=meta,
        )
    except core._InputValidationError as e:
        emit(type="error", code="input", message=str(e))
        return 3
    except ValueError as e:
        emit(type="error", code="data", message=str(e))
        return 3
    if out is None or out.model is None:
        checks = None
        try:
            checks = out.metadata.data.checks.model_dump()
        except Exception:
            pass
        emit(type="error", code="checks", message="The data checks failed.", checks=checks)
        return 4
    latency = None
    try:
        latency = out.metadata.data.latency.calibration.recommended
    except Exception:
        pass
    emit(type="stage", stage="export", latency=latency)
    out.model.net.export(
        a.outdir,
        basename=a.basename,
        user_metadata=meta,
        other_metadata={TRAINING_KEY: out.metadata.model_dump()},
    )
    emit(type="done", file=os.path.join(a.outdir, a.basename + ".nam"), esr=out.metadata.validation_esr, latency=latency)
    return 0


if __name__ == "__main__":
    sys.exit(main())
