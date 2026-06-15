# Beerkats logo

Save the Beerkats logo PNG here as **`beerkats-logo.png`** (this exact path: `app/public/beerkats-logo.png`).

It's used in both infographics (Game Recap + Player Breakdown) via
`src/components/infographic/BeerkatsLogo.tsx`. The logo sits on the same cream
background (#F4EDDB) as the infographic, so a square PNG composites seamlessly.

If the file is missing, the infographic automatically falls back to the
vector badge in `BeerkatsBadge.tsx`, so nothing breaks — but add the real logo
for the intended look.

Recommended: a square PNG, ~600px+ per side (it renders at 130–150px but
exports at 2× for crisp PNGs).
