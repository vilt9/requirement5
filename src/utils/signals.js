import {
  LuAtom,
  LuBell,
  LuBrain,
  LuBug,
  LuCircleDollarSign,
  LuCrown,
  LuEarth,
  LuEyeClosed,
  LuFingerprint,
  LuFlame,
  LuFlaskConical,
  LuGem,
  LuKeyRound,
  LuLeaf,
  LuPersonStanding,
  LuPill,
  LuRocket,
  LuScanEye,
  LuShield,
  LuSparkles,
  LuSprout,
  LuSunMoon,
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
  { key: 'growth', label: 'Growing', Icon: LuSprout, color: '#69db78', accent: '#e8d85a' },
  { key: 'bell', label: 'Bell', Icon: LuBell, color: '#ffb84d', accent: '#ef6f6c' },
  { key: 'credit', label: 'Value', Icon: LuCircleDollarSign, color: '#f2ca52', accent: '#55d889' },
  { key: 'shield', label: 'Shield', Icon: LuShield, color: '#61aef2', accent: '#a87cff' },
  { key: 'leaf', label: 'Leaf', Icon: LuLeaf, color: '#72d572', accent: '#d4d85d' },
  { key: 'earth', label: 'Earth', Icon: LuEarth, color: '#4dc7a1', accent: '#58a8ee' },
  { key: 'hidden', label: 'Hidden', Icon: LuEyeClosed, color: '#9d82d8', accent: '#ee76a7' },
  { key: 'fingerprint', label: 'Fingerprint', Icon: LuFingerprint, color: '#e582bd', accent: '#69cfea' },
  { key: 'remedy', label: 'Remedy', Icon: LuPill, color: '#ff7b78', accent: '#68c9ed' },
  { key: 'bug', label: 'Bug', Icon: LuBug, color: '#9cdb62', accent: '#ef8560' },
  { key: 'human', label: 'Human', Icon: LuPersonStanding, color: '#edaa65', accent: '#e87cac' },
  { key: 'key', label: 'Key', Icon: LuKeyRound, color: '#f1cd58', accent: '#71b6ef' },
  { key: 'cycle', label: 'Cycle', Icon: LuSunMoon, color: '#f0b957', accent: '#8c7de3' }
];

export const signalByKey = Object.fromEntries(
  SIGNALS.map(signal => [signal.key, signal])
);
