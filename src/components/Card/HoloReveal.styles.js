import { css, keyframes } from 'styled-components';

const glitchReveal = keyframes`
  0% { clip-path: inset(48% 0 48% 0); }
  18% { clip-path: inset(16% 58% 68% 0); }
  34% { clip-path: inset(62% 0 18% 42%); }
  50% { clip-path: inset(8% 32% 72% 12%); }
  66% { clip-path: inset(38% 8% 24% 20%); }
  82% { clip-path: inset(5% 3% 7% 4%); }
  100% { clip-path: inset(0); }
`;

// Every holographic layer reads the choreography from its card container, so
// Veil artwork and generated effects enter as one material.
export const holoRevealTransition = css`
  transition:
    opacity var(--holo-reveal-duration, 0.2s) var(--holo-reveal-easing, ease),
    clip-path var(--holo-reveal-duration, 0.2s) var(--holo-reveal-easing, ease),
    -webkit-mask-size var(--holo-reveal-duration, 0.2s) var(--holo-reveal-easing, ease),
    mask-size var(--holo-reveal-duration, 0.2s) var(--holo-reveal-easing, ease);

  .card-container[data-holo-reveal='iris'] & {
    clip-path: circle(0% at var(--mx, 50%) var(--my, 50%));
  }

  .card-container[data-holo-reveal='iris'].moving & {
    clip-path: circle(150% at var(--mx, 50%) var(--my, 50%));
  }

  .card-container[data-holo-reveal='wipe'] & {
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
  }

  .card-container[data-holo-reveal='wipe'][data-holo-direction='right'] & {
    -webkit-mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    -webkit-mask-position: left center;
    mask-position: left center;
    -webkit-mask-size: 0% 100%;
    mask-size: 0% 100%;
  }

  .card-container[data-holo-reveal='wipe'][data-holo-direction='left'] & {
    -webkit-mask-image: linear-gradient(to left, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    mask-image: linear-gradient(to left, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    -webkit-mask-position: right center;
    mask-position: right center;
    -webkit-mask-size: 0% 100%;
    mask-size: 0% 100%;
  }

  .card-container[data-holo-reveal='wipe'][data-holo-direction='down'] & {
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    -webkit-mask-position: center top;
    mask-position: center top;
    -webkit-mask-size: 100% 0%;
    mask-size: 100% 0%;
  }

  .card-container[data-holo-reveal='wipe'][data-holo-direction='up'] & {
    -webkit-mask-image: linear-gradient(to top, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    mask-image: linear-gradient(to top, #000 0%, #000 calc(100% - var(--holo-reveal-softness, 12%)), transparent 100%);
    -webkit-mask-position: center bottom;
    mask-position: center bottom;
    -webkit-mask-size: 100% 0%;
    mask-size: 100% 0%;
  }

  .card-container[data-holo-reveal='wipe'][data-holo-direction='right'].moving &,
  .card-container[data-holo-reveal='wipe'][data-holo-direction='left'].moving & {
    -webkit-mask-size: calc(100% + var(--holo-reveal-softness, 12%)) 100%;
    mask-size: calc(100% + var(--holo-reveal-softness, 12%)) 100%;
  }

  .card-container[data-holo-reveal='wipe'][data-holo-direction='down'].moving &,
  .card-container[data-holo-reveal='wipe'][data-holo-direction='up'].moving & {
    -webkit-mask-size: 100% calc(100% + var(--holo-reveal-softness, 12%));
    mask-size: 100% calc(100% + var(--holo-reveal-softness, 12%));
  }

  .card-container[data-holo-reveal='shutter'] & {
    clip-path: inset(50% 0 50% 0 round 15px);
  }

  .card-container[data-holo-reveal='shutter'].moving & {
    clip-path: inset(0 round 15px);
  }

  .card-container[data-holo-reveal='glitch'] & {
    clip-path: inset(48% 0 48% 0);
  }

  .card-container[data-holo-reveal='glitch'].moving & {
    animation: ${glitchReveal} var(--holo-reveal-duration, 0.35s) steps(1, end) both;
  }

  @media (hover: hover) {
    .card-container[data-holo-reveal='iris']:hover & {
      clip-path: circle(150% at var(--mx, 50%) var(--my, 50%));
    }

    .card-container[data-holo-reveal='wipe'][data-holo-direction='right']:hover &,
    .card-container[data-holo-reveal='wipe'][data-holo-direction='left']:hover & {
      -webkit-mask-size: calc(100% + var(--holo-reveal-softness, 12%)) 100%;
      mask-size: calc(100% + var(--holo-reveal-softness, 12%)) 100%;
    }

    .card-container[data-holo-reveal='wipe'][data-holo-direction='down']:hover &,
    .card-container[data-holo-reveal='wipe'][data-holo-direction='up']:hover & {
      -webkit-mask-size: 100% calc(100% + var(--holo-reveal-softness, 12%));
      mask-size: 100% calc(100% + var(--holo-reveal-softness, 12%));
    }

    .card-container[data-holo-reveal='shutter']:hover & {
      clip-path: inset(0 round 15px);
    }

    .card-container[data-holo-reveal='glitch']:hover & {
      animation: ${glitchReveal} var(--holo-reveal-duration, 0.35s) steps(1, end) both;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 1ms;
    animation-duration: 1ms !important;
  }
`;
