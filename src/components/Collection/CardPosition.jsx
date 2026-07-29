import styled from 'styled-components';
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

const MiniSlot = ({ slot }) => {
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

  return (
    <Slot $current={slot.current} $owned={slot.owned} aria-label={label}>
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

const CardPosition = ({ position }) => {
  if (!position?.global) return null;

  return (
    <PositionView>
      <Band>
        <Heading><strong>{ordinal(position.global.rank)}</strong> rarest card</Heading>
        <Slots aria-label="Cards around this global rarity position">
          {position.global.cards.map(slot => (
            <MiniSlot key={`global-${slot.position}`} slot={slot} />
          ))}
        </Slots>
      </Band>

      {position.source && (
        <Band>
          <Heading>
            <strong>{position.source.collected}/{position.source.total}</strong>
            {' '}collected from <span>{position.source.label}</span>
          </Heading>
          <Slots aria-label={`Cards from ${position.source.label}`}>
            {position.source.cards.map(slot => (
              <MiniSlot key={`source-${slot.position}`} slot={slot} />
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

  @media (max-width: 374px) {
    inset: 12px;
    gap: 20px;
  }
`;

const Band = styled.section``;

const Heading = styled.h2`
  margin: 0 0 11px;
  color: #f4eee3;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: -0.045em;

  strong {
    color: var(--gold-bright);
    font-weight: 500;
  }

  span { color: var(--amber-text); }

  @media (max-width: 374px) {
    margin-bottom: 9px;
    font-size: 12px;
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
  width: 34px;
  min-width: 0;
  justify-self: center;
  color: ${p => p.$current
    ? 'var(--gold-bright)'
    : p.$owned ? 'var(--amber-text)' : 'var(--amber-dim)'};
  transform: ${p => p.$current ? 'translateY(-2px)' : 'none'};

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
  justify-content: space-between;
  gap: 2px;
  margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 7px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  @media (max-width: 374px) {
    font-size: 6px;
  }
`;

export default CardPosition;
