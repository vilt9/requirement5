import {
  LuAtom,
  LuBrain,
  LuCrown,
  LuFlame,
  LuFlaskConical,
  LuGem,
  LuRocket,
  LuScanEye,
  LuSparkles,
  LuSprout,
  LuTrophy,
  LuZap
} from 'react-icons/lu';

export const SIGNALS = [
  { key: 'flame', label: 'Fire', Icon: LuFlame, color: '#ff6b45', accent: '#ffcc4d' },
  { key: 'charge', label: 'Electric', Icon: LuZap, color: '#ffe34f', accent: '#49d7ff' },
  { key: 'launch', label: 'Taking off', Icon: LuRocket, color: '#ff8d4d', accent: '#db59ff' },
  { key: 'sparkle', label: 'Brilliant', Icon: LuSparkles, color: '#f5d96b', accent: '#ff69bd' },
  { key: 'trophy', label: 'Winner', Icon: LuTrophy, color: '#f6bd4f', accent: '#ff714d' },
  { key: 'crown', label: 'Royal', Icon: LuCrown, color: '#ffd35a', accent: '#b36cff' },
  { key: 'rare', label: 'A gem', Icon: LuGem, color: '#ef75c5', accent: '#66d9ff' },
  { key: 'atom', label: 'Atomic', Icon: LuAtom, color: '#9c7cff', accent: '#4de3bd' },
  { key: 'brain', label: 'Mind blown', Icon: LuBrain, color: '#f07bb6', accent: '#ffc45c' },
  { key: 'scan', label: 'Visionary', Icon: LuScanEye, color: '#58d4ff', accent: '#9b73ff' },
  { key: 'experiment', label: 'Experimental', Icon: LuFlaskConical, color: '#6de0b1', accent: '#ff7a70' },
  { key: 'growth', label: 'Growing', Icon: LuSprout, color: '#69db78', accent: '#e8d85a' }
];

export const signalByKey = Object.fromEntries(
  SIGNALS.map(signal => [signal.key, signal])
);
