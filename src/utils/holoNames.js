// R5c display names for the five holographic techniques. The data keys
// (rareHolo, rareHoloGalaxy, …) are frozen — published cards and the CLI
// depend on them — so renaming happens here, in one place.
export const HOLO_NAMES = {
  overlay: 'Veil',            // customHoloImageUrl — image blended straight over the card
  rareHolo: 'Prism',          // rainbow bands
  rareHoloGalaxy: 'Nebula',   // stretching galaxy gradient
  wowaHolo: 'Signal',         // angular sweep
  rareHoloVmax: 'Pulse'       // high-contrast bands
};
