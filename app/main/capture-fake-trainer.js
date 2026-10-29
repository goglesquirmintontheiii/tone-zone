// Fake nam-train.py for tests (TZ_CAPTURE_FAKE_TRAINER=1). Same arguments and "TZ {json}" output, and it
// writes a tiny valid .nam (a plain gain) so the capture flow can be tested without Python or PyTorch.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const epochs = +arg('--epochs', 10);
const outdir = arg('--outdir');
const base = arg('--basename', 'model');
const stopFile = arg('--stop-file', '');
const ms = +(process.env.TZ_CAPTURE_FAKE_SPEED || 120);
const emit = (o) => process.stdout.write('TZ ' + JSON.stringify(o) + '\n');

if (args.includes('--check')) {
  emit({ type: 'check', nam: 'fake', torch: 'fake', gpu: false, device: 'CPU' });
  process.exit(0);
}
if (!fs.existsSync(arg('--output', '')) || !fs.existsSync(arg('--input', ''))) {
  emit({ type: 'error', code: 'data', message: 'missing input or output file' });
  process.exit(3);
}
const stages = ['loading', 'device', 'checks'];
let epoch = 0, batch = 0;
const BATCHES = 8;
const esrAt = (e) => 0.5 * Math.exp(-e / Math.max(2, epochs / 4)) + 0.004;
const step = () => {
  if (stages.length) {
    emit({ type: 'stage', stage: stages.shift(), gpu: false, device: 'CPU' });
    return setTimeout(step, ms);
  }
  const stop = stopFile && fs.existsSync(stopFile);
  if (!stop && epoch < epochs) {
    batch++;
    emit({ type: 'batch', epoch, batch, batches: BATCHES });
    if (batch >= BATCHES) {
      batch = 0;
      epoch++;
      emit({ type: 'epoch', epoch, epochs, esr: esrAt(epoch), secs: (ms * BATCHES) / 1000 });
    }
    return setTimeout(step, ms / BATCHES);
  }
  const esr = esrAt(Math.max(1, epoch));
  emit({ type: 'esr', esr, esrs: [esr] });
  emit({ type: 'stage', stage: 'export', latency: 0 });
  fs.mkdirSync(outdir, { recursive: true });
  const file = path.join(outdir, base + '.nam');
  const nam = {
    version: '0.5.4',
    architecture: 'Linear',
    config: { receptive_field: 1, bias: false },
    weights: [0.5],
    sample_rate: 48000,
    metadata: { name: arg('--name', ''), modeled_by: 'Tone Zone', gear_type: arg('--gear-type', '') || null, tone_type: arg('--tone-type', '') || null },
  };
  fs.writeFileSync(file, JSON.stringify(nam));
  emit({ type: 'done', file, esr, latency: 0 });
};
step();
