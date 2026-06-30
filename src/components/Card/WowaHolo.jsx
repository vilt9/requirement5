import styled from 'styled-components';
import { CardContainer } from './Card.styles';

// Create a dedicated component for the WOWA Holo effect
const WowaHolo = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background-position: center;
  background-size: 100% 100%;
  opacity: 0;
  transition: opacity 0.2s ease;
  transform: translateZ(5px);
  z-index: 6;
  overflow: hidden;
  mix-blend-mode: soft-light;
  pointer-events: none;
  display: ${({ $active }) => $active ? 'block' : 'none'};
  
  /* WOWA Holo effect specific styles */
  --space: 4%;
  
  background-image:
    url("../../assets/new_shiny_imgs/illusion.png"),
    repeating-linear-gradient(
      var(--angle, 45deg),
      rgba(255, 140, 0, 0.4) calc(var(--space)*1),   /* Orange */
      rgba(255, 215, 0, 0.4) calc(var(--space)*2),   /* Gold */
      rgba(255, 255, 0, 0.4) calc(var(--space)*3),   /* Yellow */
      rgba(173, 255, 47, 0.4) calc(var(--space)*4),  /* Green-yellow */
      rgba(50, 205, 50, 0.4) calc(var(--space)*5),   /* Lime green */
      rgba(0, 191, 255, 0.4) calc(var(--space)*6),   /* Deep sky blue */
      rgba(30, 144, 255, 0.4) calc(var(--space)*7),  /* Dodger blue */
      rgba(138, 43, 226, 0.4) calc(var(--space)*8)   /* Blue violet */
    ),
    /* Add a radial gradient that follows mouse position */
    radial-gradient(
      ellipse at var(--mx) var(--my),
      rgba(255, 255, 255, 0.7) 0%,
      rgba(255, 255, 255, 0.3) 30%,
      rgba(0, 0, 0, 0.3) 80%
    );
  
  background-blend-mode: color-dodge, screen, overlay;
  background-size: 300% 300%, 200% 700%, 200% 200%;
  background-position: var(--posx) var(--posy), 0% var(--posy), var(--posx) var(--posy);
  
  filter: brightness(calc((var(--hyp) + 0.7) * 0.8)) contrast(1.8) saturate(1.2);
  mix-blend-mode: color-dodge;
  
  /* More gradual transition on hover for smoother effect */
  ${CardContainer}:hover & {
    opacity: ${({ $active }) => $active ? 0.9 : 0};
    transition: opacity 0.3s ease-in-out;
  }
`;

export default WowaHolo;
