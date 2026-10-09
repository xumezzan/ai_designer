// One serializable browser read; the checks operate on its measured data.
export async function snapshot(page, assets) {
  return page.evaluate((assets) => {
    const root = document.querySelector("main.invitation");
    if (!root) throw new Error("Invitation renderer missing");
    const selector = (element) => {
      const parts = [];
      for (let node = element; node && node !== root; node = node.parentElement) {
        if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
        if (!node.parentElement) { parts.unshift(node.tagName.toLowerCase()); break; }
        const siblings = [...node.parentElement.children].filter((sibling) => sibling.tagName === node.tagName);
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
      }
      return parts.join(" > ") || "main.invitation";
    };
    const rgba = (value) => { const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const ctx = canvas.getContext("2d"); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const rect = (box) => ({ x: box.left + scrollX, y: box.top + scrollY, w: box.width, h: box.height });
    const fragments = [], clipping = [], fonts = [], measures = [], widows = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node, id = 0;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || node.parentElement.closest('[aria-hidden="true"], script, style')) continue;
      const element = node.parentElement, style = getComputedStyle(element);
      if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const glyphs = ctx.measureText(node.textContent.trim());
      let color = rgba(style.color);
      if (color[3] === 0 && element.closest(".foil-text")) color = rgba(getComputedStyle(root).getPropertyValue("--foil-color"));
      const key = selector(element);
      for (const box of range.getClientRects()) {
        if (!box.width || !box.height) continue;
        const measured = { ...rect(box), id, selector: key, color: color.slice(0, 3), alpha: color[3], size: parseFloat(style.fontSize), weight: Number(style.fontWeight) || 400 };
        // Range rectangles include unused font ascender/descender space. Compare
        // visible glyph extents so closely stacked names do not falsely collide.
        if (Number.isFinite(glyphs.fontBoundingBoxAscent) && glyphs.actualBoundingBoxAscent + glyphs.actualBoundingBoxDescent > 0) {
          measured.ink = { x: measured.x, y: measured.y + Math.max(0, glyphs.fontBoundingBoxAscent - glyphs.actualBoundingBoxAscent), w: measured.w, h: Math.min(measured.h, glyphs.actualBoundingBoxAscent + glyphs.actualBoundingBoxDescent) };
        }
        fragments.push(measured);
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
          const css = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
          const clipX = ["hidden", "clip"].includes(css.overflowX), clipY = ["hidden", "clip"].includes(css.overflowY);
          if ((clipX && (box.left < bounds.left - 1 || box.right > bounds.right + 1)) || (clipY && (box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1))) {
            clipping.push({ selector: key, ancestor: selector(ancestor) }); break;
          }
        }
      }
      id++;
    }
    for (const element of root.querySelectorAll("[data-level]")) {
      const css = getComputedStyle(element), family = css.fontFamily.split(",")[0].replaceAll('"', "").trim();
      const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
      const font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize}`;
      const probe = element.textContent.trim().slice(0, 200);
      ctx.font = `${font} ${css.fontFamily}`; const actual = ctx.measureText(probe).width;
      ctx.font = `${font} "${family}"`; const expected = ctx.measureText(probe).width;
      const loaded = [...document.fonts].some((face) => face.family.replaceAll('"', "") === family && face.status === "loaded");
      fonts.push({ selector: selector(element), family, loaded, difference: Math.abs(actual - expected) });
    }
    for (const element of root.querySelectorAll("p, address")) {
      if (element.textContent.trim().length < 100) continue;
      const css = getComputedStyle(element), canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
      ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const average = ctx.measureText(element.textContent.trim().slice(0, 200)).width / Math.min(200, element.textContent.trim().length);
      measures.push({ selector: selector(element), characters: element.getBoundingClientRect().width / average });
    }
    for (const element of root.querySelectorAll("h1, h2, h3")) {
      const lines = new Map(), words = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = words.nextNode())) for (const match of text.textContent.matchAll(/\S+/g)) {
        const range = document.createRange(); range.setStart(text, match.index); range.setEnd(text, match.index + match[0].length);
        const box = range.getBoundingClientRect(), line = Math.round(box.top / 3) * 3;
        lines.set(line, (lines.get(line) ?? 0) + 1);
      }
      const values = [...lines.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
      if (values.length > 1 && values.at(-1) === 1 && values.slice(0, -1).some((count) => count > 1)) widows.push({ selector: selector(element) });
    }
    const taps = [...root.querySelectorAll("a, button, input, select, textarea, summary, [role=button]")].map((element) => ({ selector: selector(element), ...rect(element.getBoundingClientRect()) })).filter((box) => box.w && box.h);
    const photos = [...root.querySelectorAll(".directed-photo")].map((figure) => {
      const image = figure.querySelector("img"), asset = assets.find((asset) => asset.id === figure.dataset.photoId);
      const box = figure.getBoundingClientRect(), fit = getComputedStyle(image).objectFit;
      const scale = fit === "contain" ? Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight) : Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
      const position = getComputedStyle(image).objectPosition.split(" ").map((value) => parseFloat(value) / 100);
      const x = (image.naturalWidth * scale - box.width) * position[0], y = (image.naturalHeight * scale - box.height) * position[1];
      const safe = asset?.safeArea;
      const valid = safe && safe.x * image.naturalWidth * scale - x >= -1 && safe.y * image.naturalHeight * scale - y >= -1 && (safe.x + safe.w) * image.naturalWidth * scale - x <= box.width + 1 && (safe.y + safe.h) * image.naturalHeight * scale - y <= box.height + 1;
      return { selector: selector(figure), id: figure.dataset.photoId, density: scale ? 1 / scale : 0, protected: Boolean(valid), ...rect(box) };
    });
    const busy = photos.flatMap((photo) => fragments.filter((text) => Math.min(text.x + text.w, photo.x + photo.w) - Math.max(text.x, photo.x) > 2 && Math.min(text.y + text.h, photo.y + photo.h) - Math.max(text.y, photo.y) > 2).map((text) => ({ selector: text.selector })));
    const animations = document.getAnimations().filter((animation) => animation.playState === "running").length;
    return { viewport: innerWidth, height: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, fragments, clipping, fonts, measures, widows, taps, photos, busy, animations };
  }, assets);
}
