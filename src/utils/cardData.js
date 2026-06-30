// Collection of card image data
export const cardImages = [
  {"bed_elephant": ["_1", "_2", "_3", "_4"]},
  {"blue_smoke_chairs": ["_1", "_2", "_3", "_4"]},
  {"colour_glass": ["_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8"]},
  {"dark_flowers": ["_1", "_2", "_3"]},
  {"digital_race": ["_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8"]},
  {"green_world": ["_1", "_2", "_3", "_4"]},
  {"monochrome_nature": ["_1", "_2", "_3", "_4"]},
  {"shell_dragons": ["_1", "_2", "_3", "_4"]},
  {"the_machine": ["_1", "_2", "_3", "_4"]},
  {"white_mushrooms": ["_1", "_2", "_3"]},
  {"wolf_toys": ["_1", "_2", "_3", "_4"]}
];

// Helper function to get a random item from an array
export const getRandomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// Helper function for HSL to HEX conversion
export const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
