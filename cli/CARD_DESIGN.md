# Designing R5 cards that are *subtly stunning*

Art-direction guide for whoever (human or agent) turns an image into a card spec
for `r5c publish`. It is about **taste**, not syntax — for the field-by-field
reference run `r5c help spec`, and for the CSS internals of each holo effect see
[`../HOW_DIFFERENT_HOLO_EFFECTS_DIFFER.md`](../HOW_DIFFERENT_HOLO_EFFECTS_DIFFER.md).

The goal is a card that looks expensive: the artwork is the hero, it sits
beautifully still, and it *catches the light* as it moves — a whisper of holo,
never a repaint. Most bad cards fail the same way: too much added on top of art
that was already doing the work.

---

## 0. The one rule

**The image is the hero. Everything else is lighting.** Before adding anything,
assume the answer is "less." A great card is usually the artwork, a cohesive dark
frame, and a restrained sheen — nothing more.

---

## 1. How a card renders (mental model)

A card is a stack of layers, bottom to top:

1. **Base background** (`card.baseBackground`) — a gradient behind the art.
   Visible only in the frame margins and wherever the image opacity drops.
2. **Pattern** (`card.patternInfo`) — a faint texture (constellation, hexagons…).
3. **The artwork** (`image`) — object-fit: cover, the hero.
4. **Borders** (`card.borderEffects`) — thick panel + thin edge highlight.
5. **Holo systems** (`card.holoEffects` + params) — opt-in; see §6.
6. **Motion gloss** — a *built-in* white sheen that sweeps the card while it
   moves. Always present; tuned by `imageShineIntensity` (§5). This is the layer
   that most often ruins dark art.

Only `tier` is required. A minimal spec (`{tier, image}`) already produces a
coherent card from good defaults; everything in `card.*` deep-merges over them.

---

## 2. The two states that matter: REST and MOTION

**The card page and collection grids auto-orbit the card.** A viewer spends most
of their time watching it *move*, not at rest. So you must design for both:

- **At rest** the artwork shows clean on the dark frame. Almost any image looks
  good here.
- **In motion** the gloss and any holo layers fade in. This is where cards blow
  out — a still frame at the peak of the orbit is the worst case, and it's what
  people screenshot.

**Always evaluate a card in motion, at the brightest point of the orbit**, not
just the resting frame. If it looks muddy there, dial it back.

---

## 3. Read the image first

Spend a moment on the artwork before choosing a single knob:

| Read | Ask | Drives |
|---|---|---|
| **Luminosity** | Dark/cinematic, mid, or bright/pastel? | `imageShineIntensity`, vignette |
| **Dominant hue** | What colour rules the frame? | `backgroundColor.baseHue`, border tint |
| **Subject** | Portrait, landscape, abstract, object? | pattern, parallax, holo choice |
| **Mood** | Ominous, playful, premium, cosmic, neon? | which holo system, or none |
| **Busyness** | Detailed or clean negative space? | pattern opacity, holo strength |

The single most important read is **luminosity**, because the built-in motion
gloss is calibrated for mid/bright images and *over-brightens dark ones*.

---

## 4. Colour: one hue seeds everything

`backgroundColor.baseHue` (0–360) is the master colour knob. From it the card
derives two **companion hues** used by the sheen and gradients:

- **second hue = baseHue + 60**
- **third hue = baseHue + 180** (the complement)

So a blue card (`baseHue: 214`) automatically pulls **amber/gold** (214+180≈34)
into its sheen — which is exactly why a blue, dark image can shimmer *gold* and
look wrong. Know this and either lean into it or mute it (lower `sheenSaturate`).

**Match, don't fight.** Set `baseHue` near the image's dominant hue for harmony.
Use the complement deliberately only when you want pop.

**Retint the borders.** Defaults are **gold** (`rgba(255,215,0,…)`). Gold clashes
with cool/dark art. Set `borderEffects.color`, `edgeColor1`, `thinEdgeColor` to a
tint drawn from the image (steel/ice for cool scenes, warm for sunset palettes).

---

## 5. What washes out dark cards (the two culprits)

Dark, cinematic art looks perfect **at rest** and then blows out **in motion**.
Two layers cause this, in order of impact:

### 5a. The border hover panel — **the big one** (`borderEffects.colorHover`, `opacityHover`)

`.card-border` is a full-face panel over the artwork. **While the card moves** it
switches to `borderEffects.colorHover` at `borderEffects.opacityHover`. The
defaults are **gold `rgba(255,235,120,0.6)` at opacity 0.9** — a near-opaque gold
sheet that drops over the whole card every time it orbits. Because the page
auto-orbits (§2), *this gold wash is what viewers actually see.*

**Setting `borderEffects.color` does NOT fix this** — `color` is the resting
tint; the moving panel reads `colorHover`/`opacityHover` separately. You must set
those too:

```json
"borderEffects": {
  "color":      "rgba(150,180,210,0.30)",  "opacity": 0.30,
  "colorHover": "rgba(150,180,210,0.35)",  "opacityHover": 0.22,
  "edgeColor1": "rgba(165,195,225,0.5)",   "thinEdgeColor": "rgba(205,225,245,0.7)"
}
```

Rule: **whenever you retint borders, set `colorHover` and `opacityHover` too**,
drawn from the image. For dark art keep `opacityHover` ≤ 0.25. Leaving them
default is the #1 reason a card looks gorgeous still and garish in motion.

### 5b. The motion gloss — `effectParams.imageShineIntensity` (secondary)

A stack of white `overlay`-blend layers also sweeps the card in motion. It's much
milder than the border panel, but on very dark art it still lifts the frame.
`imageShineIntensity` multiplies it:

| Image luminosity | `imageShineIntensity` | Result |
|---|---|---|
| **Dark / cinematic** | 0.25 – 0.4 | Restrained tilt-catch |
| **Mid / balanced** | 0.4 – 0.6 | Clear holographic sweep |
| **Bright / pastel / glossy** | 0.7 – 1.0 | Full shine, the classic look |

`1.0` ≈ the legacy fixed gloss. (This knob was historically inert — it read a
value shown on the card page as "Shine intensity" but changed nothing; it's now
wired. Cards that don't set it fall back to ≈ `0.6 + rarity·0.4`.)

Other restraint levers for dark art:
- Keep `imageEffects.opacity: 1` (let the art stay solid).
- Lower `patternInfo.opacity` to ~0.2 or drop the pattern.
- Keep the base background dark and cohesive so the frame doesn't glow.

---

## 6. The holo systems — pick one, or none

Six opt-in techniques live under `card.holoEffects`. They **stack on top of** the
built-in gloss, so enabling one adds *more* light. For most auto-generated cards
from strong artwork, **enable none** and let the motion gloss (§5) be the whole
effect. Reach for a system only when the image *asks* for it:

| System (`holoEffects` key) | Character | Use when the art is… |
|---|---|---|
| *(none)* | Just the built-in gloss | Already strong; dark/cinematic |
| **`overlay`** (the **Veil**) | Card-wide sheen; the modern "standard" holo. Reads `holoImage` if given, else a hue-derived sheen | Premium, subtle; you want a refined tilt-shimmer or a custom light-leak overlay |
| `rareHolo` | Tight rainbow bands | Playful, toy-like, vibrant |
| `rareHoloGalaxy` | Space texture, yellow→blue→pink | Cosmic, nebula, starfields |
| `wowaHolo` | Orange→blue illusion sweep | Bold graphic, poster-like |
| `rareHoloVmax` | Pink/red premium shine | Character/hero splash, high drama |

### The Veil (`overlay`) — the subtle premium one

Best default when you *do* want an added effect. Tune it with `effectParams`:

- `veilPresence` — opacity **at rest** (0 = invisible until it moves). Keep 0–0.1.
- `sheenShine` — multiplier on the moving opacity (0.4–0.7 for subtle).
- `sheenSpace` — band width; higher = softer, wider bands (16–22 = gentle).
- `sheenSaturate` — **mute the gold complement** here (0.6–0.8) on cool images.
- `sheenAngle`, `sheenDrift` — direction offset and how far it slides on tilt.
- `aberrationIntensity` — a faint RGB-split shimmer on tilt (0.1–0.2 = tasteful).
- `customHoloBlendMode` — `soft-light` (gentle) or `color-dodge` (bright).

Give the Veil a `holoImage` (a brushed-metal streak, a light leak, or a
luminance mask of the art) and it blends *that* instead of the generic sheen —
the frontier for "shimmer that respects the picture." Supplying `holoImage`
auto-enables `overlay`.

---

## 6b. The reveal is the moment — design holo activation as drama

**Holo is invisible at rest and appears on hover/motion. That transition is not a
side effect — it is the card's one theatrical beat, and you should author it.** A
flat sheen that just fades in wastes it. The best cards are one thing when still
and *become* something when touched. Think in two frames — **rest** and
**activated** — and make the jump between them mean something.

The rule that keeps this from becoming garish: **the drama must be *of* the
image, not pasted on it.** Tasteful → considered → shocking is all allowed — but
the reveal should look like the artwork's own latent energy switching on, in the
card's own palette and logic. Shocking ≠ random. A serene portrait should not
detonate; a dead city *should* be allowed to blaze to life.

### Choreograph the entrance

The reveal itself is authored under `effectParams`; it applies to the Veil and
every enabled holo system as one transition:

| Field | Values | Character |
|---|---|---|
| `holoRevealMode` | `fade` | Neutral crossfade; the backwards-compatible default |
|  | `iris` | Opens from the point of touch; good for portals, eyes, suns, wells |
|  | `wipe` | Travels across the card with a feathered boundary; good for weather, water, time shifts |
|  | `shutter` | Opens outward from the center; architectural, ceremonial, mechanical |
|  | `glitch` | Fragmented slices lock into the holo state; signals, corruption, broken realities |
| `holoRevealDuration` | `0.05–3` seconds | 0.2 is quick, 0.6 is readable, 1.2 is ceremonial |
| `holoRevealEasing` | `smooth`, `snap`, `elastic`, `linear` | The movement's emotional character |
| `holoRevealDirection` | `right`, `left`, `down`, `up` | Wipe direction (`right` means left-to-right) |
| `holoRevealSoftness` | `0–40` | Width of the wipe's blended edge |

Choose the choreography from the image's internal logic. A waterfall can wipe
upward, a portal can iris from the pointer, a sealed monument can shutter open,
and signal damage can glitch. Preview the beginning and middle of activation,
not only rest and the fully active pose: the transition is part of the card.

### The technique: a feature mask, hidden then ignited

1. **Derive a mask from the artwork** so the effect is registered to the picture.
   A **glow map** is the workhorse: crush the shadows to black and keep only the
   bright/meaningful areas (city lights, god-rays, eyes, water, metal), then
   richen them. In practice: `sharp(img).linear(~2.5, ~-190).modulate({saturation:1.4})`.
2. **Feed it as `holoImage`** (auto-enables the Veil).
3. **Hide it at rest:** `veilPresence: 0` — the card is calm and complete when still.
4. **Ignite on activation:** `customHoloBlendMode: "color-dodge"` + `sheenShine: ~0.9`.
   color-dodge does nothing to the black areas and *blooms* the bright ones — so
   only the lights come alive.
5. **Keep it registered:** `sheenDrift: ~0.15` so the glow stays roughly locked to
   the buildings/features instead of sliding off them.

Worked example — **"Lost Cities" ignites**: at rest, a dark, silent metropolis.
On hover, the whole city glows molten, the ring-city edge catches gold, the
clouds flare electric blue — the dark rock untouched. The mask is the artwork's
own highlights, so the drama is unmistakably *its own*. That's considered drama.

### A palette of reveals (pick one that fits the vibe)

- **Ignite** — bright features bloom to life (city, embers, neon, stars). *(above)*
- **Latent layer** — a second `holoImage` that only exists in holo mode: a hidden
  glyph, constellation, circuit, or text that surfaces as you tilt.
- **State shift** — the mood turns: day→dusk, calm→storm, a portrait's eyes light,
  water begins to move (recolour via a tinted mask + `soft-light`/`overlay`).
- **Prism catch** — crank `aberrationIntensity` so light fans into spectral edges
  only at steep tilt, like a real foil card catching a lamp.

### Restraint (what keeps drama valuable)

- **Match the vibe.** Loud reveals for epic/energetic art; a slow cool shimmer for
  quiet/premium art. The reveal should feel inevitable, not applied.
- **Register to the image.** Low `sheenDrift`; masks derived from the artwork, not
  generic textures. Misregistered drama reads as a bug.
- **Ration it.** If every card detonates, nothing lands. Reserve the biggest
  reveals for the rarest tiers — let drama scale with rarity so a `vmax` *earns*
  its spectacle and a `common` stays a gentle sheen.

---

## 7. Background, pattern, depth

- **`baseBackground`** — `type` radial|linear|conic|solid; `color1/2/3` +
  `useThird`; `vignette` (0.1–0.55, pulls focus inward); `grain` (0–0.22, a
  printed, tactile feel). For most photographic art a dark, low-key background
  drawn from the image's shadows keeps the frame cohesive.
- **`patternInfo`** — keep `opacity` low (0.2–0.4) so it reads as texture, not
  noise. Drop it entirely on busy images.
- **`effectParams.parallaxDepth`** (0–1) — the art shifts against the frame on
  tilt, like a window into the scene. 0.4–0.6 gives depth to landscapes and
  scenes; keep low for flat graphic art.

---

## 8. The "subtly stunning" rulebook

Defaults that tend to look expensive:

- Artwork opacity **1.0**; touch `contrast`/`saturation` by at most ±0.1.
- Borders retinted from the palette **including `colorHover` + `opacityHover`**
  (§5a) — the #1 lever; skipping the hover pair is what turns cards gold in motion.
- `imageShineIntensity` matched to luminosity (§5b) — the secondary gloss dial.
- Background **dark and cohesive**, drawn from the image's own shadows.
- `vignette` 0.3–0.45, `grain` 0.06–0.12, `parallaxDepth` 0.4–0.6.
- **At most one** holo system, tuned low — or none.
- `rarityScore` near the middle of the tier's band unless you mean otherwise.

**Don't:** stack multiple holo systems; add a gold accent to a dark image "to
make it pop"; push saturation/brightness > 1.3; leave a busy pattern over busy
art; judge the card only at rest.

---

## 9. Worked example — the Lost Cities post-mortem

Real card, real mistakes. Source: a dark, cinematic r/midjourney piece — an
inverted ring-city over a vast metropolis, deep blues, god-rays.

**First attempt (wrong):** `baseHue: 218`, a **gold** background stop
(`color3: #c9a35f`) added "to echo the city lights," and — the fatal one — the
border hover pair left at default. In motion the card washed **gold/olive**. At
*rest* it looked great; only when it orbited did the wash appear.

**What actually caused it (verified by isolating each layer in the browser):**
the **border hover panel** (§5a). `.card-border` switched to its default
`colorHover` (gold `rgba(255,235,120,0.6)`) at `opacityHover` 0.9 during motion —
a near-opaque gold sheet over the whole card. I had set `borderEffects.color` to
a cool tint but *not* `colorHover`/`opacityHover`, so the gold defaults stayed.
The built-in motion gloss and my gold background were minor contributors; the
panel was ~all of it. Lesson: **`color` ≠ `colorHover`**, and the card is almost
always seen in motion, so the hover values are the ones that matter.

**Corrected spec:**

```json
{
  "name": "Lost Cities #159",
  "tier": "ultra",
  "tags": ["cityscape", "sci-fi", "cinematic"],
  "image": "./lost_cities_159.jpg",
  "card": {
    "backgroundColor": { "baseHue": 214 },
    "baseBackground": {
      "type": "radial", "color1": "#0d1622", "color2": "#05070d", "color3": "#16283f",
      "useThird": true, "posX": 50, "posY": 22, "vignette": 0.34, "grain": 0.07
    },
    "patternInfo": { "type": "Constellation", "opacity": 0.22 },
    "effectParams": { "parallaxDepth": 0.55, "imageShineIntensity": 0.35 },
    "imageEffects": { "opacity": 1, "contrast": 1.05, "saturation": 1.03 },
    "borderEffects": {
      "color": "rgba(150,180,210,0.30)",      "opacity": 0.30,
      "colorHover": "rgba(150,180,210,0.35)", "opacityHover": 0.22,
      "edgeColor1": "rgba(165,195,225,0.5)",  "thinEdgeColor": "rgba(205,225,245,0.7)"
    }
  }
}
```

The lesson: dark cinematic art wants a **cool, cohesive dark frame** with borders
retinted to the palette **including the hover pair** (`colorHover`/`opacityHover`)
— that single fix removed the wash. The gloss (`imageShineIntensity`) can then sit
at a normal ~0.35; it was never the problem.

---

## 10. Copy-paste recipes

**Dark / cinematic** (landscapes, sci-fi, moody): see §9.
Cool dark background; borders retinted **with `colorHover`/`opacityHover`≤0.25**
(the fix that matters); `imageShineIntensity: 0.3–0.4`; pattern ≤ 0.22; no extra holo.

**Bright / pastel** (soft portraits, pastel abstracts):
`imageShineIntensity: 0.7–0.9`, light warm background, `patternInfo.opacity: 0.4`,
optionally `holoEffects.overlay` with `sheenShine: 0.6`.

**Neon / vaporwave**:
`baseHue` on the neon (e.g. 300), `holoEffects.rareHolo`, `rareHoloParams.space: 1.5`,
`customHoloBlendMode: "color-dodge"`, higher `saturation`.

**Cosmic / nebula**:
`holoEffects.rareHoloGalaxy`, `baseHue` 250–280, `patternInfo.type: "Constellation"`,
`parallaxDepth: 0.6`.

**Character / hero splash**:
`holoEffects.rareHoloVmax` OR the Veil with a light-leak `holoImage`,
`parallaxDepth: 0.5`, borders tinted to the character's key colour.

**Ignite (reveal-as-drama)** — see §6b: glow-map `holoImage` from the artwork,
`veilPresence: 0`, `customHoloBlendMode: "color-dodge"`, `sheenShine: ~0.9`,
`sheenDrift: ~0.15`. At rest calm; on hover the bright features blaze to life.
Best for epic/energetic art and higher tiers.

---

## 11. Gotchas

- **The card auto-orbits.** Judge it in motion, at the shine peak (§2) — a
  resting screenshot hides the single worst problem.
- **`borderEffects.color` ≠ `borderEffects.colorHover`.** The moving card uses
  the hover pair, which defaults to **gold at 0.9**. Retint both or the card goes
  gold in motion (§5a). This is the most common and worst mistake.
- **`overlay` (the Veil) is the modern holo** but was rejected by older CLI
  validation — now allowed, and auto-enabled when you pass `holoImage`.
- **`baseHue`'s complement (+180) tints the sheen** — a blue card shimmers gold.
- Keep `imageEffects.opacity` high; the background/holo showing *through* the art
  is rarely what you want for photographic images.
