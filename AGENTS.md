# Product and design intent

Invitation Studio creates invitations that guests primarily open on **mobile
phones**. The invitation renderer and the studio editor are different surfaces:
the editor can use desktop space, while invitation art direction starts with the
phone. This is the user's explicit requirement, reiterated on 2026-10-12.

- Design the invitation first at **390×844**, with touch, and check **320–430px**.
  Desktop arrangements are enhancements of the mobile composition. Do not start
  with a desktop poster and merely shrink it.
- Give the phone a complete vertical story: a recognisable opening, prominent
  names/date, readable event facts, deliberate section rhythm and obvious guest
  actions. Keep text live; optional facts/sections stay absent when not supplied.
- Materials need visible weight: consistent light, contact shadows, edges,
  thickness, overlap, surface detail and measured movement. Texture alone is
  insufficient. Choose a distinct material/graphic language for each concept.
- Independent designs differ in composition, silhouette, focal relationship,
  material and typography. A palette change alone does not establish variety.
- Guest interactions must work with touch and vertical scrolling. Hover tilt is
  an optional enhancement. Controls need comfortable touch targets; gallery
  swiping must not trap vertical scrolling. Opening an invitation must be clear.
- Keep content readable without JavaScript and with reduced motion. Avoid
  perpetual large moving layers; pause ambient motion when hidden. Prioritise
  mobile load/scroll performance and preserve all protected photographic crops.
- Use the ChungDoi **individual opened previews**, rather than its catalog or
  marketing-page layout, as the reference for invitation design. Study notes and
  per-template mobile evidence live in [docs/chungdoi-mobile](docs/chungdoi-mobile/README.md).
  Reference graphics, customer photographs, names and template code are never
  implementation assets. Create original materials and compositions.

- The owner's `gatsby-invitation` and `jafar-sitora_premium` repositories are
  explicit website quality references. Study notes and mobile evidence are in
  [docs/source-references](docs/source-references/README.md). Build a complete
  web story with live typography, authored decoration, protected photographs,
  section rhythm and meaningful interactions. `cinematic` and `portrait-story`
  provide native implementations of these principles.
- New creation requests produce **one resolved design**. Use original bitmap
  artwork only when that composition needs it; native website stories use their
  code and supplied media. Keep their copy and event facts editable in the studio.

When adding or revising a renderer, visually review the opening and the complete
mobile page before using desktop screenshots to assess it. Report observed
reference behaviour separately from our supported implementation and proposals.

- Invitation sections have a stable semantic order: opening photo/identity,
  guest description, date/countdown, location, programme, dress code, wishes,
  guest response, farewell. Later additions occupy this place automatically.
  Keep the chosen design's type/material/light and give each role its own
  composition. Backgrounds belong to roles, never alternating child indexes.
  Empty optional blocks stay absent; pinned photo placements honour the owner.
