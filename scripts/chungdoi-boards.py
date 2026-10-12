import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path('docs/chungdoi-mobile')
report = json.loads((base / 'measurements.json').read_text())
items = [t for t in report['templates'] if t['status'] == 'opened']
(base / 'boards').mkdir(exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
for start in range(0, len(items), 12):
    chunk = items[start:start + 12]
    # A complete-page strip for every invitation exposes section rhythm and
    # continuity. It complements readable detail crops; neither is a taste score.
    fulls = [Image.open(base / item['fullShot']).convert('RGB') for item in chunk]
    height = max(round(im.height / 3) for im in fulls) + 65
    overview = Image.new('RGB', (1632, height), '#eae7e0')
    draw = ImageDraw.Draw(overview)
    for j, (item, full) in enumerate(zip(chunk, fulls)):
        x = j * 136
        draw.text((x + 3, 4), f'{start + j + 1:02d}', fill='#293830', font=font)
        for n, line in enumerate([item['id'][:18], item['id'][18:36]]):
            draw.text((x + 3, 28 + n * 14), line, fill='#293830', font=small)
        overview.paste(full.resize((130, round(full.height / 3))), (x + 3, 65))
    overview.save(base / 'boards' / f'{start // 12 + 1:02d}-full-pages.jpg', quality=93)
    for pair, fields in [('page', ['heroShot', 'middleShot']), ('entry-exit', ['coverShot', 'footerShot'])]:
        board = Image.new('RGB', (1840, 1668), '#eae7e0')
        draw = ImageDraw.Draw(board)
        for j, item in enumerate(chunk):
            x, y = (j % 4) * 460, (j // 4) * 556
            draw.text((x + 8, y + 8), f'{start + j + 1:02d} {item["id"]}', fill='#293830', font=font)
            draw.text((x + 8, y + 34), item['name'][:48], fill='#293830', font=small)
            for k, field in enumerate(fields):
                if field == 'coverShot':
                    shot = Image.open(base / item[field]).convert('RGB')
                else:
                    # Full-page capture is stable under mobile CDP emulation.
                    # Crops are presentation aids, not additional viewport tests.
                    full = Image.open(base / item['fullShot']).convert('RGB')
                    top = 0 if field == 'heroShot' else max(0, full.height - 844) if field == 'footerShot' else round(full.height * .42)
                    shot = full.crop((0, top, 390, top + 844))
                shot = shot.resize((220, 476))
                board.paste(shot, (x + 8 + k * 224, y + 65))
        board.save(base / 'boards' / f'{start // 12 + 1:02d}-{pair}.jpg', quality=91)
print(f'{len(items)} templates assembled')
