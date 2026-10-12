"""Prepare static WOFF2 subsets while keeping real OpenType glyph variants.

Offline helper for prepare-fonts.mjs. Requires FontTools[woff] only when
regenerating the committed assets, never during installation, build or runtime.
"""
import copy
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def codepoints(css_range):
    points = set()
    for part in css_range.split(","):
        value = part.strip().removeprefix("U+")
        lo, hi = value.split("-", 1) if "-" in value else (value, value)
        points.update(range(int(lo, 16), int(hi, 16) + 1))
    return points


for job in json.loads(Path(sys.argv[1]).read_text()):
    for weight in job["weights"]:
        original = TTFont(job["source"], recalcTimestamp=False)
        if "fvar" in original:
            axes = {axis.axisTag: axis.defaultValue for axis in original["fvar"].axes}
            axes["wght"] = weight
            static = instantiateVariableFont(original, axes, inplace=True)
        else:
            if weight != original["OS/2"].usWeightClass:
                raise ValueError(f'Static font {job["id"]} does not provide weight {weight}')
            static = original
        for language, unicode_range in job["ranges"].items():
            font = copy.deepcopy(static)
            options = subset.Options()
            options.layout_features = ["*"]
            options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
            options.notdef_outline = True
            options.recommended_glyphs = True
            sub = subset.Subsetter(options=options)
            sub.populate(unicodes=codepoints(unicode_range))
            sub.subset(font)
            font.flavor = "woff2"
            font.recalcTimestamp = False
            path = Path(job["output"]) / f'{job["id"]}-{language}-{weight}-normal.woff2'
            font.save(path)
        print(f'{job["id"]} {weight}: three subsets, all available layout features retained', flush=True)
