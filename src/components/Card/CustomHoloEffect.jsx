import styled from 'styled-components';
import { CardContainer } from './Card.styles';

// Veil — the card-wide "standard" holographic layer. With an image it blends
// that straight over the card; without one it falls back to a hue-matched
// sheen gradient, so the technique works with no upload at all. Every knob
// reads a CSS variable with a neutral fallback: cards saved before the knobs
// existed render exactly as they always did.
//
//   --sheen-angle       degrees ADDED to the live pointer angle (0 = follow)
//   --sheen-space       gradient band period (gradient mode only)
//   --sheen-shine       multiplier on the moving opacity   (1 = original 0.9)
//   --veil-presence     opacity at rest                    (0 = original)
//   --sheen-brightness / --sheen-contrast / --sheen-saturate
//                       multipliers on the original filter constants
//   --sheen-drift       how far the layer slides with the tilt (1 = original)
//   --sheen-ab          chromatic aberration: red/blue ghosts split with tilt
const CustomHoloEffect = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background-position: center;
  background-size: 100% 100%;
  opacity: var(--veil-presence, 0);
  transition: opacity 0.2s ease;
  transform: translateZ(5px);
  z-index: 6;
  overflow: hidden;
  pointer-events: none;
  display: ${({ $active }) => $active ? 'block' : 'none'};

  /* The image is the veil when given; otherwise a repeating sheen built from
     the card's own hue family, angled off the live pointer angle. */
  background-image: ${({ $imageUrl }) => $imageUrl
    ? `url("${$imageUrl}")`
    : `repeating-linear-gradient(
        calc(var(--holo-angle, 45deg) + var(--sheen-angle, 0deg)),
        hsla(var(--base-hue, 220), 60%, 78%, 0.55) 0,
        hsla(var(--second-hue, 280), 70%, 82%, 0.6) calc(var(--sheen-space, 12%) * 0.33),
        hsla(var(--third-hue, 40), 65%, 78%, 0.55) calc(var(--sheen-space, 12%) * 0.66),
        hsla(var(--base-hue, 220), 60%, 78%, 0.55) var(--sheen-space, 12%)
      )`};
  background-size: ${({ $imageUrl }) => $imageUrl ? 'cover' : '220% 220%'};
  background-position:
    calc(50% + (var(--posx, 50%) - 50%) * var(--sheen-drift, 1))
    calc(50% + (var(--posy, 50%) - 50%) * var(--sheen-drift, 1));

  /* Add mouse-responsive shine effects */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at var(--mx) var(--my),
      rgba(255, 255, 255, 0.7) 0%,
      rgba(255, 255, 255, 0.3) 30%,
      rgba(0, 0, 0, 0.1) 80%
    );
    mix-blend-mode: overlay;
  }

  /* Chromatic aberration: a red and a blue ghost of the shine, split apart
     by the aberration knob and only as strong as the tilt. At the 0 default
     this paints nothing. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: calc(var(--sheen-ab, 0) * (var(--hyp, 0) + 0.25));
    background:
      radial-gradient(
        ellipse at calc(var(--mx, 50%) - var(--sheen-ab, 0) * 7%) var(--my, 50%),
        rgba(255, 0, 80, 0.5) 0%,
        rgba(255, 0, 80, 0) 55%
      ),
      radial-gradient(
        ellipse at calc(var(--mx, 50%) + var(--sheen-ab, 0) * 7%) var(--my, 50%),
        rgba(0, 150, 255, 0.5) 0%,
        rgba(0, 150, 255, 0) 55%
      );
    mix-blend-mode: screen;
    pointer-events: none;
  }

  /* Dynamic blend modes on hover */
  mix-blend-mode: ${({ $blendMode }) => $blendMode || 'color-dodge'};

  /* Apply filter based on mouse movement — the restored filter knobs
     multiply the original constants (all default to 1). */
  filter:
    brightness(calc((var(--hyp) + 0.7) * 0.8 * var(--sheen-brightness, 1)))
    contrast(calc(1.5 * var(--sheen-contrast, 1)))
    saturate(calc(1.2 * var(--sheen-saturate, 1)));

  /* Alive while the card is driven (.moving covers real pointer AND the
     simulated touch tour). The :hover rule is gated to real-hover devices:
     touch screens keep :hover STUCK after the finger lifts, which left the
     overlay half-faded instead of returning to rest. */
  ${CardContainer}.moving & {
    opacity: ${({ $active }) => $active ? 'calc(0.9 * var(--sheen-shine, 1))' : '0'};
  }
  @media (hover: hover) {
    ${CardContainer}:hover & {
      opacity: ${({ $active }) => $active ? 'calc(0.9 * var(--sheen-shine, 1))' : '0'};
    }
  }
`;

export default CustomHoloEffect;
