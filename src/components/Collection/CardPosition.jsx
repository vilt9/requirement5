import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { poolCardToCardData } from '../../utils/poolCard';

const ordinal = (value) => {
  const n = Number(value) || 0;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
};

const rarityText = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3).replace(/^0/, '') : '—';
};

const baseBackground = (data) => {
  const base = data?.baseBackground;
  if (base) {
    const {
      type = 'linear',
      color1 = '#10131c',
      color2 = '#05060a',
      color3 = '#1a1430',
      useThird = false,
      angle = 135,
      posX = 50,
      posY = 50,
      fadeStart = 0,
      fadeEnd = 100
    } = base;
    if (type === 'solid') return color1;
    const middle = (Number(fadeStart) + Number(fadeEnd)) / 2;
    const stops = useThird
      ? `${color1} ${fadeStart}%, ${color3} ${middle}%, ${color2} ${fadeEnd}%`
      : `${color1} ${fadeStart}%, ${color2} ${fadeEnd}%`;
    if (type === 'radial') return `radial-gradient(circle at ${posX}% ${posY}%, ${stops})`;
    if (type === 'conic') return `conic-gradient(from ${angle}deg at ${posX}% ${posY}%, ${stops})`;
    return `linear-gradient(${angle}deg, ${stops})`;
  }

  const legacy = data?.backgroundColor;
  if (legacy && typeof legacy === 'object') {
    return legacy.isGradient ? legacy.gradient : legacy.color;
  }
  return legacy || '#15110b';
};

export const MiniSlot = ({
  slot,
  linkOwned = false,
  reveal = false,
  revealIndex = 0
}) => {
  const cardData = slot.owned ? poolCardToCardData(slot.card) : null;
  const imageUrl = cardData?.imagePath === 'custom_image'
    ? cardData.customImageUrl
    : cardData?.imagePath && cardData.imagePath !== 'default'
      ? `/assets/card_images/${cardData.imagePath}`
      : null;
  const shine = cardData?.effectParams?.shineColor2 || 'rgba(232, 180, 85, .34)';
  const border = cardData?.borderEffects?.color || cardData?.borderEffects?.borderColor;
  const label = slot.owned
    ? `${slot.current ? 'Current' : 'Collected'} card, position ${slot.position}, rarity ${rarityText(slot.rarity)}`
    : `Uncollected card, position ${slot.position}, rarity ${rarityText(slot.rarity)}`;
  const linked = linkOwned && slot.owned && slot.card?.id;

  return (
    <Slot
      {...(linked ? { as: Link, to: `/card/${slot.card.id}` } : {})}
      $current={slot.current}
      $owned={slot.owned}
      $linked={linked}
      $reveal={reveal}
      aria-label={label}
      style={{ '--reveal-index': revealIndex }}
    >
      <MiniFace
        $owned={slot.owned}
        $current={slot.current}
        style={border ? { '--mini-border': border } : undefined}
      >
        {cardData && (
          <MiniRender style={{ background: baseBackground(cardData), '--mini-shine': shine }}>
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                style={{
                  opacity: cardData.imageEffects?.opacity ?? 1,
                  mixBlendMode: cardData.imageEffects?.blendMode || 'normal'
                }}
              />
            )}
            <span aria-hidden />
          </MiniRender>
        )}
      </MiniFace>
      <SlotMeta>
        <span>{slot.position}</span>
        <span>{rarityText(slot.rarity)}</span>
      </SlotMeta>
    </Slot>
  );
};

const CardPosition = ({ position, active = false }) => {
  if (!position?.global) return null;

  return (
    <PositionView>
      <Band $reveal={active} $delay="0.14s">
        <Heading><strong>{ordinal(position.global.rank)}</strong> rarest card</Heading>
        <Slots aria-label="Cards around this global rarity position">
          {position.global.cards.map((slot, index) => (
            <MiniSlot
              key={`global-${slot.position}`}
              slot={slot}
              reveal={active}
              revealIndex={index}
            />
          ))}
        </Slots>
      </Band>

      {position.source && (
        <Band $reveal={active} $delay="0.30s">
          <Heading>
            <strong>{position.source.collected}/{position.source.total}</strong>
            {' '}collected from <span>{position.source.label}</span>
          </Heading>
          <Slots aria-label={`Cards from ${position.source.label}`}>
            {position.source.cards.map((slot, index) => (
              <MiniSlot
                key={`source-${slot.position}`}
                slot={slot}
                reveal={active}
                revealIndex={position.global.cards.length + index}
              />
            ))}
          </Slots>
        </Band>
      )}
    </PositionView>
  );
};

const PositionView = styled.div`
  position: absolute;
  inset: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  color: var(--amber-dim);
  text-align: left;

  @media (max-width: 374px) {
    inset: 12px;
    gap: 20px;
  }
`;

const Band = styled.section`
  ${p => p.$reveal && `
    animation: bandResolve 0.26s ease both;
    animation-delay: ${p.$delay};
  `}

  @keyframes bandResolve {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Heading = styled.h2`
  margin: 0 0 11px;
  color: var(--amber-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0.01em;
  text-align: left;

  strong {
    color: inherit;
    font-weight: 400;
  }

  span { color: inherit; }

  @media (max-width: 374px) {
    margin-bottom: 9px;
  }
`;

const Slots = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  column-gap: 4px;
  row-gap: 10px;
  align-items: end;

  @media (max-width: 374px) {
    column-gap: 2px;
    row-gap: 7px;
  }
`;

const Slot = styled.div`
  --slot-lift: ${p => p.$current ? '-2px' : '0px'};
  width: 34px;
  min-width: 0;
  justify-self: center;
  color: var(--amber-dim);
  transform: translateY(var(--slot-lift));
  text-decoration: none;
  transition: transform 0.16s ease, color 0.16s ease;

  ${p => p.$reveal && `
    animation: slotResolve 0.30s cubic-bezier(.2, .72, .25, 1) both;
    animation-delay: calc(0.18s + var(--reveal-index) * 0.016s);
  `}

  ${p => p.$linked && `
    cursor: pointer;
    &:hover {
      color: var(--amber-dim);
      text-decoration: none;
      transform: translateY(-2px);
    }
  `}

  @keyframes slotResolve {
    from {
      opacity: 0;
      transform: translateY(calc(var(--slot-lift) + 7px)) scale(.88);
    }
    to {
      opacity: 1;
      transform: translateY(var(--slot-lift)) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @media (max-width: 374px) {
    width: 30px;
  }
`;

const MiniFace = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 5 / 7;
  overflow: hidden;
  border: 1px solid ${p => p.$current
    ? 'var(--gold-bright)'
    : p.$owned ? 'rgba(205, 177, 133, .68)' : 'var(--panel-border)'};
  border-radius: 4px;
  background:
    radial-gradient(
      circle at 50% 43%,
      transparent 0 20%,
      rgba(205, 177, 133, .10) 21% 23%,
      transparent 24%
    ),
    linear-gradient(145deg, rgba(255,255,255,.028), rgba(255,255,255,.006));
  box-shadow: ${p => p.$current
    ? '0 0 18px rgba(232, 180, 85, .18)'
    : p.$owned ? '0 0 12px rgba(232, 180, 85, .10)' : 'none'};

  ${p => p.$owned && `
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--mini-border, transparent) 50%, transparent) inset,
      ${p.$current ? '0 0 18px rgba(232, 180, 85, .18)' : '0 0 12px rgba(232, 180, 85, .10)'};
  `}

  @media (max-width: 374px) {
    border-radius: 3px;
  }
`;

// A static miniature uses the card's real background, artwork, blend and shine
// colours without mounting the full interactive holo DOM for every owned slot.
// That keeps a fully-owned 26-slot receipt lightweight.
const MiniRender = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #15110b;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    position: absolute;
    inset: 0;
    border: 3px solid color-mix(in srgb, var(--mini-border, rgba(255,255,255,.32)) 55%, transparent);
    background:
      linear-gradient(128deg, transparent 18%, var(--mini-shine) 48%, transparent 72%),
      radial-gradient(circle at 30% 24%, rgba(255,255,255,.50), transparent 12%);
    mix-blend-mode: screen;
    opacity: .68;
  }
`;

const SlotMeta = styled.div`
  display: flex;
  justify-content: flex-start;
  gap: 3px;
  margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 7px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--amber-dim);
  text-align: left;

  @media (max-width: 374px) {
    font-size: 6px;
  }
`;

export default CardPosition;
