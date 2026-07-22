import process from 'node:process';

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const operatorConfig = () => ({
  key: String(process.env.R5OPS_API_KEY || ''),
  studioUsername: String(process.env.R5OPS_STUDIO_USERNAME || '').trim(),
  maxOpeningBalance: positiveNumber(process.env.R5OPS_MAX_OPENING_BALANCE, 10000)
});
