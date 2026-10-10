# M1 screenshot critique

All five themes use the same content and section components. Composition is a
named layout preset; no selector refers to a concept ID or theme name.

## Loop 1 — build, observe, rebuild (390×844)

Screenshots: `m1/loop-1.jpg`, `m1/loop-1-poster.jpg`.

The letter's names are legible, but the hero is 1,032.7px high before the demo
toolbar: adding 66svh padding below already spaced text makes the pause feel
like a missing section. The poster is broken: `max-width: 7ch` is measured in
its 16px parent, producing a 70.5px name column and splitting ordinary names.
Its percentage-positioned date follows the entire padded hero height and
collides with the address. A poster's date must align to the names, not to an
empty reserve below them.

Rebuild: give the name wrapper the display's actual font metrics; put the
poster date in a real grid track; let the first-screen surface occupy 100svh
without adding another 66svh after the content. The default letter preserves
the large empty *area* around the type rather than an extra empty screen.

## Loop 2 — build, observe, rebuild (390×844)

Screenshots: `m1/loop-2.jpg`, `m1/loop-2-folio.jpg`.

The poster now keeps ordinary names whole, and the date is separate from the
address. The folio still uses an absolute percentage for its date: the date
box at x24–130, y363.8–505.6 overlaps the address box at x102.7–366,
y398.9–457.6. A visual offset is not a substitute for a flow constraint.
The navigation also starts in directory order, leaving the active letter
outside the initial mobile strip. Repeating a full floral divider before
every section would make the cultural motif into filler.

Rebuild: use grid tracks in the folio too, with names above the right-hand
address and the date in a separate left track; list compositions in the menu's
deliberate order; grant the divider one major pause, not seven repetitions.

## Loop 3 — build, observe, rebuild (325px and 390px)

Screenshots: `m1/loop-3.jpg`, `m1/loop-3-arch.jpg`.

The folio's date and address now occupy separate tracks, including the narrower
325px stress view. The floral frame in the ceremony theme is still too literal:
a full eight-petal medallion lies behind the names, making the letters compete
with its centre. Scaling the same SVG into every placement is not a complete
ornament pack. The cultural reference should act as a small signature around
an architectural frame, rather than a logo behind a title.

Rebuild: give the packs a real frame element, with an arch and a small radial
motif above it. Keep the full radial geometry for the watermark/divider roles
and reduce the frame opacity. Names have a clear field within the arch.

The browser's origin zoom affects viewport overrides; actual `innerWidth` and
`innerHeight` are recorded for validation rather than inferred from the request.
Raster screenshots from this browser can include an outer blank capture margin;
that margin is not part of the invitation's CSS layout.

Final accessibility pass: raise nominal 44px links to 45px so viewport rounding
does not create a sub-44 measurement. Filled RSVP links need an ink-coloured
focus outline: inheriting their light foreground would make the outline vanish
against the matching light surface. Countdown figures use real tabular numbers
to keep the running timer's rhythm steady.

Desktop comparison: the botanical watermark initially competed with the date.
Reduce it from 50% width / .22 opacity to 38% / .08, leaving a clear field for
the month and retaining the floral motif on the outer margin.
