import styled from 'styled-components';
import { CardContainer } from './Card.styles';

// Create a dedicated component for Custom Holo effect with uploaded images
const CustomHoloEffect = styled.div`
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
  pointer-events: none;
  display: ${({ $active }) => $active ? 'block' : 'none'};
  
  /* Custom Holo effect specific styles */
  background-image: ${({ $imageUrl }) => $imageUrl ? `url("${$imageUrl}")` : 'none'};
  background-size: cover;
  background-position: var(--posx) var(--posy);
  
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
  
  /* Dynamic blend modes on hover */
  mix-blend-mode: ${({ $blendMode }) => $blendMode || 'color-dodge'};
  
  /* Apply filter based on mouse movement */
  filter: brightness(calc((var(--hyp) + 0.7) * 0.8)) contrast(1.5) saturate(1.2);
  
  /* Alive while the card is driven (.moving covers real pointer AND the
     simulated touch tour). The :hover rule is gated to real-hover devices:
     touch screens keep :hover STUCK after the finger lifts, which left the
     overlay half-faded instead of returning to rest. */
  ${CardContainer}.moving & {
    opacity: ${({ $active }) => $active ? '0.9' : '0'};
  }
  @media (hover: hover) {
    ${CardContainer}:hover & {
      opacity: ${({ $active }) => $active ? '0.9' : '0'};
    }
  }
`;

export default CustomHoloEffect;
