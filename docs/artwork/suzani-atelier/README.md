# Suzani Atelier — generated design revision

The user rejected the sparse M1 concepts and asked for generated backgrounds,
materials and patterns to make the invitations feel expensive. This revision
develops one complete direction, accessible at `/preview/demo/arch/2`.
Original v1 themes are retained. SPEC was changed before extending the schema.

## Direction and delivery

Oxblood velvet, raised champagne-gold embroidery, pomegranates and Suzani
flowers form a tactile wedding frame. Names/date/address are live HTML placed
over its quiet centre. The lower sections share the velvet material, a
separately generated botanical flourish, gold rules and a framed RSVP letter.
No names, contact details, forms or buttons were sent to the image generator.

Built-in `image_gen` was used, not the API/CLI fallback. Production files are:

- `public/artwork/suzani-atelier/hero-v1.webp` — 1024×1536, 399,076 bytes.
- `public/artwork/suzani-atelier/velvet-v1.webp` — 1254×1254, 389,160 bytes.
- `public/artwork/suzani-atelier/flourish-v2.webp` — 2172×724 with alpha, 415,810 bytes.

Original PNGs are saved alongside this document. [manifest.json](./manifest.json)
records hashes, sizes, provenance and encoding settings. WebP conversion
preserves the original dimensions and transparency. Next Image additionally
serves responsive frame/flourish variants; the texture is a CSS background.
No new dependency was installed (Sharp was already supplied through Next).

Select `artwork: "suzani-atelier"` in JSON. The registry owns the asset paths;
the theme cannot inject a remote URL. `none` defaults preserve old themes.
CSS belongs to the named art direction and never targets a concept id.
Demo navigation finds the latest existing numbered version. This revision
does not yet implement automatic image generation inside the studio.

## Critique

`loop-1-mobile.jpg` and `loop-1-desktop.jpg` show the first integrated build.
The embroidery supplies the missing material detail without competing with
names in the centre. Mobile uses the full viewport for the frame, while the
desktop presents it as a centered textile invitation against the same material.
The portrait background adapts its height with the hero; fine ornament
proportions vary slightly across screen sizes. An image-generation retry
cleaned up the flourish's thread detail. Bright red/yellow regions visible in
the tool preview were alpha=1/255 edge pixels, not visible neon stitching:
inspection found zero such pixels above alpha=30/255 in the chosen source.

The initial raster optimization used 75% for Next's output; 90% retains more
stitch detail. Long-form sections use subdued texture rather than repeating
the entire frame, with one independent branch at the major pause. The live
body text and RSVP remain readable if decorative assets cannot load.

## Verification

`npm test` passed 116 tests; TypeScript, ESLint and the production build passed.
New checks cover opt-in/default behavior, local asset files, live text in SSR,
retention of the original snapshot and navigation to the latest version.

Production browser checks passed at actual 320×800, 384×960, 390×844, 768×1024
and 1440×900. Every view contains eight sections and one foil element, without
document overflow, text extending beyond viewport width, intersections between
hero meaning blocks or sub-44px invitation controls. [qa.json](./qa.json) stores
measurements. Other four themes passed a desktop regression check in
[qa-regression.json](./qa-regression.json). Palette validation passes unchanged;
the generated image's every pixel was not evaluated for WCAG contrast.

Hero/flourish images loaded through Next Image at quality 90. The material
background resolves to a local WebP. The arrow scrolls to the greeting and
the footer returns to the hero. Keyboard focus on RSVP has a visible 2px cream
outline. No warning/error messages were returned in the final fresh production
tab. No phone call or external RSVP submission was made. Full Lighthouse and
automated image-generation-in-studio testing are outside this revision.

Final screenshots: [desktop](./final-desktop.jpg), [mobile](./final-mobile.jpg),
[narrow](./final-narrow.jpg), [greeting](./final-greeting.jpg), [RSVP](./final-rsvp.jpg).

## Exact generation prompts

### Frame — new image, opaque

Use case: stylized-concept. Asset type: production background artwork for a luxury Uzbek wedding web invitation, not a website mockup. Produce one portrait 2:3 composition, high resolution. Straight-on, flat full-bleed textile artwork, no perspective, no cards photographed on a table. Deep oxblood and mulberry velvet/silk with believable fine weave, subtle material light, richly embroidered antique champagne-gold and muted rose threads forming botanical Suzani pomegranate flowers, curling stems and eight-petal rosettes. Dense exquisite embroidery mainly confined to the outer left/right 16% margins and upper/lower border; an architectural arch embroidered above an EMPTY broad centre. The central 60% width, from 22% to 78% height, must remain very dark, quiet, unpatterned burgundy fabric so large cream typography can later be overlaid in real HTML. Ornamental edge visible but without gaudy jewels or artificial glowing gold; craft-level uneven metallic threads, raised stitching, restrained highlights. Cohesive wedding stationery art direction with tactile depth and detailed handmade embroidery. No people, no photographs, absolutely NO letters, no names, no monograms, no numbers, no logos, no watermark, no interface or frames around the image. Entire image is the material and embroidery.

### Velvet — new image, opaque

Use case: stylized-concept. Asset type: seamless material texture for the whole scrolling page of a bespoke wedding invitation. Generate one square 1:1 straight-on macro swatch of extremely dark oxblood silk velvet, fine short pile and fine horizontal woven fibres, rich tactile textile microtexture, controlled very low contrast, subtle mulberry and wine variations, consistent flat soft diffuse light. Colour close to #240B16 to #35101E. This is ONLY a material texture, no embroidery, no flowers, no motifs, no text, no people, no folds, no dramatic light spots or shiny gradients, no vignette, no object edges or table. It must tile naturally on all four sides, evenly lit everywhere. Realistic luxurious fabric surface, understated so cream body copy stays readable. Full bleed image without any frame.

### Flourish — new image, transparent

Use case: stylized-concept. Asset type: isolated decorative embroidered flourish to place between sections of a luxury Uzbek wedding invitation. One horizontal symmetrical botanical sprig, ratio 3:1, elegantly slender and meticulously detailed, small central pomegranate with two small eight-petal Suzani flowers flanking it, curling fine leaves spreading horizontally. Real raised embroidery with antique champagne-gold silk threads and dusty garnet pink accents, precise tiny stitches and occasional soft thread highlights. View perfectly frontal, flat ornamental layout, cohesive expensive artisan textile finish, not a cartoon or simple vector line drawing. The embroidery only, isolated on genuinely TRANSPARENT background. Preserve gaps between leaves and stems with alpha. No surrounding fabric, no backdrop, no card, no shadow rectangle, no frame, no text, no letters, no numbers, no logos, no watermark. Plenty of transparent space around the fine tips, no cropped leaves.

### Flourish — targeted edit, transparent

Edit the embroidery flourish just generated. Keep exactly the same layout, pomegranate, flowers, leaves, delicate stitch detail and transparent background. Correct only the cutout edges: remove every bright red, lemon-yellow or neon fringe between leaves and around stems. There must be clean antialiased transparent alpha edges with natural muted garnet and antique champagne-gold thread colours all the way to the boundary. No flat bright red/yellow blobs. No other change, do not add any fabric, background or lettering.
