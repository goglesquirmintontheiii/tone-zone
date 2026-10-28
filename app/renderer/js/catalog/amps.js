// Amplifiers, preamps and speaker cabinets.
import { defaultMicXY, micToSpeaker } from '../gfx/cabgeom.js';
import { K, TOG, FOOT, LED, MIC, def, ten } from './helpers.js';

const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
const AMP = (o) =>
  def(Object.assign({ form: 'amp', cat: 'Amp', algo: 'amp', cost: 2.5, ports: { ins: ['INPUT'], outs: ['SPEAKER OUT'] } }, o, {
    controls: [...o.controls, LED({ color: '#ff3020', r: 4.5 }), FOOT({ action: 'bypass' })],
  }));

const marshallKnobs = (gainLabel = 'PRE-AMP', masterLabel = 'MASTER') => [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', masterLabel), k('gain', gainLabel)];
const fenderKnobs = (mid = true) => [k('gain', 'VOLUME', { scale: 10, style: 'fender' }), k('treble', 'TREBLE', { scale: 10, style: 'fender' }), ...(mid ? [k('mid', 'MIDDLE', { scale: 10, style: 'fender' })] : []), k('bass', 'BASS', { scale: 10, style: 'fender' }), k('master', 'POWER', { scale: 10, style: 'fender', def: 0.6 })];

// [id, name, ref, model, look]
export const ampDefs = [
  AMP({ id: 'amp.deluxe', name: 'US Deluxe 65', ref: 'Fender Deluxe Reverb', opts: { model: 'deluxe' }, combo: true, speakers: 1, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Delux', logoColor: '#e9e9e9', knob: 'fender', controls: [...fenderKnobs(false), TOG('bright', 'BRIGHT', ['OFF', 'ON'])], desc: 'Classic blackface clean that breaks up when pushed.' }),
  AMP({ id: 'amp.twin', name: 'US Twin 65', ref: 'Fender Twin Reverb', opts: { model: 'twin' }, combo: true, speakers: 2, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Twain', logoColor: '#e9e9e9', knob: 'fender', controls: [...fenderKnobs(true), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] }),
  AMP({ id: 'amp.bassman', name: 'Tweed Bassmaster', ref: 'Fender 1959 Bassman', opts: { model: 'bassman' }, combo: true, speakers: 2, tolex: '#c8b27c', panel: '#c9c1ad', panelText: '#2a1d10', grille: 'brown', logo: 'Bassmaster', logoColor: '#efe6d0', knob: 'chicken', piping: '#5a3a1a',
    controls: [k('presence', 'PRESENCE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('gain', 'VOLUME'), k('master', 'MASTER', { def: 0.65 })] }),
  AMP({ id: 'amp.ac30', name: 'Brit 30 Top Boost', ref: 'Vox AC30 Top Boost', opts: { model: 'ac30' }, combo: true, speakers: 2, tolex: '#1a1a1a', panel: '#7a4a2a', panelText: '#f1e3c8', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', logoPlate: '#1a1a1a', knob: 'vox', piping: '#c9b37a',
    controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] }),
  AMP({ id: 'amp.dc30', name: 'Matchbox 30', ref: 'Matchless DC-30', opts: { model: 'dc30' }, combo: true, speakers: 2, tolex: '#151515', panel: '#2b2b2b', panelText: '#f2f2f2', grille: 'salt', logo: 'Matchbox', logoColor: '#d8d8d8', knob: 'chicken',
    controls: [k('gain', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] }),
  AMP({ id: 'amp.plexi', name: 'Brit Plexi 100', ref: 'Marshall 1959 Super Lead', opts: { model: 'plexi' }, tolex: '#161616', panel: '#c9a64e', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall',
    controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'VOLUME I'), k('master', 'VOLUME II', { def: 0.65 }), TOG('bright', 'BRIGHT', ['HI', 'LO'], { values: [1, 0] })] }),
  AMP({ id: 'amp.jcm800', name: 'Brit 800', ref: 'Marshall JCM800 2203', opts: { model: 'jcm800' }, tolex: '#161616', panel: '#c9a64e', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall', controls: marshallKnobs() }),
  AMP({ id: 'amp.jubilee', name: 'Silver Jubilant', ref: 'Marshall Silver Jubilee 2555', opts: { model: 'jubilee' }, tolex: '#cfd2d6', panel: '#c6c9cd', panelText: '#121212', grille: 'black', logo: 'Marsh', logoColor: '#f4f4f4', logoPlate: '#121212', knob: 'chrome', controls: marshallKnobs('INPUT GAIN', 'OUTPUT') }),
  AMP({ id: 'amp.recto', name: 'Cali Rectifire', ref: 'Mesa/Boogie Dual Rectifier', opts: { models: ['recto_clean', 'recto'] }, tolex: '#151515', panel: '#b9bec5', panelText: '#111', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', knob: 'mesa',
    controls: [k('gain', 'GAIN'), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CH', ['CLEAN', 'MODERN'], { def: 1 })] }),
  AMP({ id: 'amp.markiic', name: 'Cali Mark IIC', ref: 'Mesa/Boogie Mark IIC+', opts: { model: 'markiic' }, combo: true, speakers: 1, tolex: '#2a2016', panel: '#151515', panelText: '#e8e8e8', grille: 'black', logo: 'Boogaloo', logoColor: '#e0c890', knob: 'mesa',
    controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('master', 'MASTER'), k('presence', 'PRESENCE')] }),
  AMP({ id: 'amp.5150', name: 'PV 5051', ref: 'Peavey 5150 / EVH', opts: { model: '5150' }, tolex: '#141414', panel: '#141414', panelText: '#e0e0e0', grille: 'black', logo: '5051', logoFont: "'Oswald', sans-serif", logoColor: '#d33', knob: 'chrome',
    controls: [k('gain', 'PRE GAIN'), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'POST GAIN'), k('depth', 'RESONANCE'), k('presence', 'PRESENCE')] }),
  AMP({ id: 'amp.slo', name: 'Solo 100', ref: 'Soldano SLO-100', opts: { model: 'slo' }, tolex: '#141414', panel: '#c7ccd2', panelText: '#121212', grille: 'black', logo: 'Solo', logoColor: '#e4e6e8', knob: 'chrome', controls: marshallKnobs('PREAMP', 'MASTER') }),
  AMP({ id: 'amp.dumble', name: 'Smooth ODS', ref: 'Dumble Overdrive Special', opts: { model: 'dumble' }, tolex: '#151515', panel: '#1c1c1c', panelText: '#e0e0e0', grille: 'wheat', logo: 'Smooth', logoColor: '#e8d8a8', knob: 'chrome',
    controls: [k('gain', 'DRIVE'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('master', 'MASTER'), k('presence', 'PRESENCE')] }),
  AMP({ id: 'amp.orange', name: 'Citrus Rockerbox', ref: 'Orange Rockerverb', opts: { model: 'orange' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', headGrille: true, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
    controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] }),
  AMP({ id: 'amp.uber', name: 'Uber Schall', ref: 'Bogner Überschall', opts: { model: 'uber' }, tolex: '#141414', panel: '#141414', panelText: '#d9d9d9', grille: 'black', logo: 'Bogart', logoColor: '#d9d9d9', knob: 'chrome', controls: marshallKnobs('GAIN', 'VOLUME') }),
  AMP({ id: 'amp.vh4', name: 'Teutonic V4', ref: 'Diezel VH4', opts: { model: 'vh4' }, tolex: '#141414', panel: '#202020', panelText: '#e0e0e0', grille: 'black', logo: 'DIESL', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', knob: 'chrome', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME'), k('depth', 'DEEP'), k('presence', 'PRESENCE')] }),
  AMP({ id: 'amp.friedman', name: 'Freed BE-100', ref: 'Friedman BE-100', opts: { model: 'friedman' }, tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'black', logo: 'Freed', logoColor: '#e0e0e0', knob: 'chrome', controls: [...marshallKnobs('GAIN', 'MASTER'), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] }),
  AMP({ id: 'amp.hiwatt', name: 'High-Watt 103', ref: 'Hiwatt DR103', opts: { model: 'hiwatt' }, tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'black', logo: 'HIGH-WATT', logoFont: "'Oswald', sans-serif", logoColor: '#f0f0f0', knob: 'chrome', controls: [k('gain', 'NORMAL VOL'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('presence', 'PRESENCE'), k('master', 'MASTER')] }),
  AMP({ id: 'amp.jc120', name: 'Jazz Clean 120', ref: 'Roland JC-120', opts: { model: 'jc120' }, combo: true, speakers: 2, tolex: '#191919', panel: '#c4c8cc', panelText: '#121212', grille: 'black', logo: 'Jazz Clean', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', knob: 'mxr', controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] }),
  // bass amps
  AMP({ id: 'amp.svt', name: 'Super Valve Bass', ref: 'Ampeg SVT Classic', cat: 'Bass Amp', opts: { model: 'svt' }, tolex: '#151515', panel: '#c7cbd0', panelText: '#121212', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#f0f0f0', logoPlate: '#2a4f9a', knob: 'mesa',
    controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDRANGE'), k('midfreq', 'FREQUENCY'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'ULTRA LO', ['OFF', 'ON']), TOG('ultrahi', 'ULTRA HI', ['OFF', 'ON'])] }),
  AMP({ id: 'amp.b15', name: 'Portaflux B15', ref: 'Ampeg B-15 Portaflex', cat: 'Bass Amp', opts: { model: 'b15' }, combo: true, speakers: 1, tolex: '#2c3d5a', panel: '#c7cbd0', panelText: '#121212', grille: 'silver', logo: 'Portaflux', logoColor: '#e8e8e8', knob: 'chicken', controls: [k('gain', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('master', 'MASTER', { def: 0.6 })] }),
  AMP({ id: 'amp.gk800', name: 'GK 800 Bass', ref: 'Gallien-Krueger 800RB', cat: 'Bass Amp', opts: { model: 'gk800' }, tolex: '#151515', panel: '#151515', panelText: '#e8e8e8', grille: 'black', headGrille: false, logo: 'GK 800', logoFont: "'Oswald', sans-serif", logoColor: '#e0e0e0', knob: 'mxr',
    controls: [k('gain', 'VOLUME'), k('presence', 'CONTOUR'), k('treble', 'TREBLE'), k('mid', 'HI MID'), k('midfreq', 'LO MID'), k('bass', 'BASS'), k('master', 'MASTER')] }),
  AMP({ id: 'amp.ad200', name: 'Citrus AD Bass', ref: 'Orange AD200', cat: 'Bass Amp', opts: { model: 'ad200' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] }),
  AMP({ id: 'amp.markbass', name: 'Bassmark Little', ref: 'Markbass Little Mark', cat: 'Bass Amp', opts: { model: 'markbass' }, tolex: '#1a1a1a', panel: '#1a1a1a', panelText: '#f5d000', grille: 'black', headGrille: false, logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', knob: 'mxr',
    controls: [k('gain', 'GAIN'), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'MASTER')] }),
  AMP({ id: 'amp.acoustic', name: 'Acoustic DI Pre', ref: 'Acoustic preamp / DI', cat: 'Preamp', opts: { model: 'acoustic' }, tolex: '#4b3324', panel: '#d9c7a4', panelText: '#2a1d10', grille: 'brown', headGrille: false, logo: 'Acoustic', logoColor: '#f3e7cf', knob: 'cream', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE')] }),
];

// Preamp-only versions (no power amp / output transformer) rendered as rack units
export const preampDefs = ampDefs
  .filter((a) => a.id !== 'amp.acoustic')
  .map((a) =>
    def({
      id: a.id.replace('amp.', 'pre.'), name: a.name + ' Pre', ref: a.ref + ' (preamp)', cat: 'Preamp', form: 'rack', algo: 'amp', cost: 1.6,
      opts: Object.assign({}, a.opts, { preamp: true }), color: a.panel === '#151515' || a.panel === '#141414' ? '#1a1b1e' : '#26282c',
      logo: a.logo.toUpperCase().slice(0, 14), typeName: 'Tube preamp', ports: { ins: ['INPUT'], outs: ['PREAMP OUT'] },
      controls: [...a.controls.filter((c) => c.t === 'knob' && c.p !== 'master' && c.p !== 'presence' && c.p !== 'depth').map((c) => Object.assign({}, c, { style: undefined, scale: undefined })), K('level', 'OUTPUT', { min: -30, max: 12, def: 0 }), LED({ color: '#3ddc84' }), FOOT()],
    })
  )
  .concat([
    def({ id: 'pre.sansamp', name: 'BassDrive DI', ref: 'Tech 21 SansAmp Bass Driver DI', cat: 'Preamp', form: 'tz', color: '#202020', text: '#e9e9e9', logo: 'BASS DRIVE', typeName: 'Bass preamp', knob: 'chrome',
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 30, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 80, midF: 2800, trebleF: 4500, midQ: 0.9, postLp: 9000, levelMaxDb: 8 },
      controls: [K('level', 'LEVEL'), K('blend', 'BLEND', { def: 0.7 }), K('treble', 'TREBLE'), K('bass', 'BASS'), K('mid', 'PRESENCE'), K('gain', 'DRIVE', { def: 0.35 }), FOOT(), LED()] }),
    def({ id: 'pre.b7k', name: 'Dark Bass Pre', ref: 'Darkglass Microtubes B7K', cat: 'Preamp', form: 'tz', color: '#5c5f63', text: '#111', logo: 'DARK B7', typeName: 'Bass preamp', knob: 'mxr',
      algo: 'drive', opts: { clip: 'mosfet', bias: 0.15, preHp: 60, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', useHiMid: true, eqRangeDb: 12, bassF: 80, midF: 500, hiMidF: 1500, trebleF: 5000, postLp: 10000, levelMaxDb: 8 },
      controls: [K('level', 'MASTER'), K('blend', 'BLEND', { def: 0.6 }), K('gain', 'DRIVE', { def: 0.5 }), K('bass', 'BASS'), K('mid', 'LO MIDS'), K('himid', 'HI MIDS'), K('treble', 'TREBLE'), FOOT(), LED({ color: '#ff2a1a' })] }),
    def({ id: 'pre.gtamp', name: 'Amp in a Box', ref: 'Tech 21 SansAmp GT2', cat: 'Preamp', form: 'tz', color: '#1f1f1f', text: '#e9e9e9', logo: 'AMP-IN-BOX', typeName: 'Guitar preamp', knob: 'chrome',
      algo: 'drive', opts: { clip: 'tube', stages: 2, bias: 0.25, gainMinDb: 4, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3500, postLp: 6000, levelMaxDb: 6,
        modes: [{ postEq: [{ type: 'peak', f: 1200, q: 0.8, db: 3 }] }, { postEq: [{ type: 'peak', f: 700, q: 0.8, db: 2 }, { type: 'lp', f: 4800, q: 0.7, db: 0 }] }, { postEq: [{ type: 'peak', f: 500, q: 0.9, db: -3 }] }] },
      controls: [K('level', 'LEVEL'), K('treble', 'HIGH'), K('bass', 'LOW'), K('gain', 'DRIVE'), { t: 'sel', p: 'mode', label: 'AMP', options: ['CALI', 'TWEED', 'BRIT'], sweep: 100, def: 2 }, FOOT(), LED({ color: '#3ddc84' })] }),
  ]);

// ------------------------------------------------------------------ cabinets
export const CAB = (o) => {
  const d = def(Object.assign({ form: 'cab', cat: o.bass ? 'Bass Cab' : 'Cab', algo: 'cab', cost: 0.9, stereo: 'both', ports: { ins: ['INPUT'], outs: ['MIC OUT'] } }, o, {
    controls: [1, 2, 3, 4].map((idx) => MIC({ idx })),
  }));
  const size = d.cabSize || '4x12';
  const m1 = defaultMicXY(size, 1);
  d.initParams = Object.assign({ m1on: 1, m1type: d.opts.mic ?? 0, m1dist: 0.15, _m1x: m1.x, _m1y: m1.y }, d.initParams || {});
  d.cabMics = true;
  d.derive = (ui) => {
    const out = {};
    for (let i = 1; i <= 4; i++) {
      if (ui[`_m${i}x`] === undefined) continue;
      const s = micToSpeaker(size, ui[`_m${i}x`], ui[`_m${i}y`]);
      out[`m${i}pos`] = s.pos;
      out[`m${i}spk`] = s.spk;
    }
    return out;
  };
  return d;
};
export const cabDefs = [
  CAB({ id: 'cab.1x12us', name: '1x12 US Deluxe', ref: 'Fender Deluxe 1x12 (Jensen)', opts: { model: '1x12us' }, cabSize: '1x12', grille: 'silver', logo: 'Delux', logoColor: '#eee' }),
  CAB({ id: 'cab.2x12twin', name: '2x12 US Twin', ref: 'Fender Twin 2x12', opts: { model: '2x12twin' }, cabSize: '2x12', grille: 'silver', logo: 'Twain', logoColor: '#eee' }),
  CAB({ id: 'cab.4x10tweed', name: '4x10 Tweed', ref: 'Fender Bassman 4x10', opts: { model: '4x10tweed' }, cabSize: '4x10', tolex: '#c8b27c', grille: 'brown', logo: 'Bassmaster', piping: '#5a3a1a' }),
  CAB({ id: 'cab.2x12blue', name: '2x12 Brit Blue', ref: 'Vox AC30 2x12 Alnico Blue', opts: { model: '2x12blue' }, cabSize: '2x12', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", piping: '#c9b37a' }),
  CAB({ id: 'cab.4x12gb', name: '4x12 Brit Greenback', ref: 'Marshall 1960B G12M Greenback', opts: { model: '4x12gb' }, cabSize: '4x12', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212' }),
  CAB({ id: 'cab.4x12t75', name: '4x12 Brit T75', ref: 'Marshall 1960A G12T-75', opts: { model: '4x12t75' }, cabSize: '4x12', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212' }),
  CAB({ id: 'cab.4x12v30', name: '4x12 Cali V30', ref: 'Mesa Rectifier 4x12 V30', opts: { model: '4x12v30' }, cabSize: '4x12', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),
  CAB({ id: 'cab.4x12uber', name: '4x12 Uber V30', ref: 'Bogner Überkab 4x12', opts: { model: '4x12uber' }, cabSize: '4x12', grille: 'black', logo: 'Bogart', logoColor: '#ddd' }),
  CAB({ id: 'cab.2x12cream', name: '2x12 Cream', ref: '2x12 Celestion Creamback', opts: { model: '2x12cream' }, cabSize: '2x12', grille: 'wheat', logo: 'TZ 212', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
  CAB({ id: 'cab.1x12open', name: '1x12 Open Blue', ref: 'Open-back 1x12 Alnico Blue', opts: { model: '1x12open' }, cabSize: '1x12', grille: 'diamond', logo: 'Chime', logoColor: '#eee' }),
  CAB({ id: 'cab.4x12orange', name: '4x12 Citrus', ref: 'Orange PPC412', opts: { model: '4x12orange' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
  CAB({ id: 'cab.2x12jc', name: '2x12 Jazz Clean', ref: 'Roland JC-120 2x12', opts: { model: '2x12jc' }, cabSize: '2x12', grille: 'black', logo: 'Jazz Clean', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),
  CAB({ id: 'cab.8x10svt', name: '8x10 Fridge', ref: 'Ampeg SVT-810E', opts: { model: '8x10svt' }, cabSize: '8x10', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#eee', logoPlate: '#2a4f9a', bass: true }),
  CAB({ id: 'cab.4x10bass', name: '4x10 Bass', ref: '4x10 bass cab with horn', opts: { model: '4x10bass' }, cabSize: '4x10', grille: 'black', logo: 'TZ 410', logoFont: "'Oswald', sans-serif", logoColor: '#ddd', bass: true }),
  CAB({ id: 'cab.1x15bass', name: '1x15 Bass', ref: 'Ampeg B-15 / 1x15', opts: { model: '1x15bass' }, cabSize: '1x15', tolex: '#2c3d5a', grille: 'silver', logo: 'Portaflux', logoColor: '#eee', bass: true }),
  CAB({ id: 'cab.2x10horn', name: '2x10 Neo + Horn', ref: 'Markbass-style 2x10 neo', opts: { model: '2x10horn' }, cabSize: '2x10', grille: 'black', logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', bass: true }),
  CAB({ id: 'cab.4x12bass', name: '4x12 Bass', ref: 'Orange OBC / 4x12 bass', opts: { model: '4x12bass' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', bass: true }),
];
