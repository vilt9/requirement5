const TRUE_VALUES = new Set(['1', 'true']);
const FALSE_VALUES = new Set(['0', 'false']);

export const parseIncludeUrl = (value) => {
  if (value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
};

export const renderVariant = (includeUrl) => includeUrl ? 'with-url' : 'no-url';

export const renderCacheKey = (id, format, count, includeUrl) => (
  format === 'frames'
    ? `${id}:frames:${count}`
    : `${id}:${format}:${renderVariant(includeUrl)}`
);

export const renderStorageStem = (id, includeUrl) => (
  `card_${id}_${renderVariant(includeUrl)}`
);

export const capturePageUrl = (baseUrl, id, includeUrl) => {
  const url = new URL(`/capture/${encodeURIComponent(id)}`, baseUrl);
  url.searchParams.set('includeUrl', includeUrl ? '1' : '0');
  return url.toString();
};
