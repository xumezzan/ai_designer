"""Content model per event type.

Produces the *sections and their copy* from the brief. Tone is deliberately
understated — no exclamation marks, no clichés — because the design will
carry the emotion. An LLM provider can rewrite this copy later
(`/ai/generate-copy`), but the structure comes from here.
"""
from __future__ import annotations

from datetime import datetime


def _fmt_date(raw: str | None) -> str:
    if not raw:
        return ""
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            d = datetime.strptime(raw[:16] if "T" in raw else raw, fmt)
            return d.strftime("%-d %B %Y")
        except ValueError:
            continue
    return raw


def _iso_target(raw: str | None, time: str | None) -> str | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            d = datetime.strptime(raw[:10], fmt)
            hh, mm = 12, 0
            if time:
                try:
                    t = datetime.strptime(time.strip()[:5], "%H:%M")
                    hh, mm = t.hour, t.minute
                except ValueError:
                    pass
            return d.replace(hour=hh, minute=mm).isoformat()
        except ValueError:
            continue
    return None


def _split_names(hosts: str) -> list[str]:
    for sep in (" & ", " and ", " и ", " + ", "&"):
        if sep in hosts:
            return [p.strip() for p in hosts.split(sep) if p.strip()]
    return [hosts.strip()] if hosts.strip() else []


def build_sections(brief: dict, event_type: str, images: list[str]) -> list[dict]:
    """Return a list of section dicts (type, props, optional variant hints)."""
    hosts = (brief.get("hosts") or brief.get("title") or "").strip()
    title = (brief.get("title") or hosts).strip()
    date = _fmt_date(brief.get("date"))
    time = (brief.get("time") or "").strip()
    venue = (brief.get("venue") or "").strip()
    city = (brief.get("city") or "").strip()
    address = (brief.get("address") or "").strip()
    place = ", ".join([p for p in [venue, city] if p])
    desc = (brief.get("description") or "").strip()
    dress = (brief.get("dressCode") or "").strip()
    target = _iso_target(brief.get("date"), time)
    img = (lambda i: images[i] if i < len(images) else None)
    gallery = [{"src": s} for s in (images[1:7] if len(images) > 1 else [])]
    while len(gallery) < 4:
        gallery.append({"src": None})

    common_details = [
        {"label": "Date", "value": date or "To be announced", "note": time or None},
        {"label": "Venue", "value": venue or "Venue", "note": address or city or None},
    ]

    if event_type in ("wedding", "engagement"):
        names = _split_names(hosts)
        heading = " & ".join(names) if len(names) >= 2 else (hosts or "Our Wedding")
        eyebrow = "Together with their families" if event_type == "wedding" else "We're engaged"
        story_body = desc or (
            "We met by chance, stayed by choice, and are now writing the next chapter together. "
            "We would be honoured to have you with us on the day."
        )
        return [
            {"type": "hero", "props": {"eyebrow": eyebrow, "heading": heading, "subheading": "invite you to celebrate" + (" their wedding" if event_type == "wedding" else " their engagement"), "date": date, "venue": place, "image": img(0), "buttonLabel": "RSVP"}},
            {"type": "story", "props": {"eyebrow": "Our story", "heading": "How it began", "body": story_body, "image": img(1)}},
            {"type": "event_details", "props": {"eyebrow": "The day", "heading": "Details", "details": common_details + [{"label": "Dress code", "value": dress or "Formal", "note": None}]}},
            {"type": "schedule", "props": {"eyebrow": "Schedule", "heading": "The order of the day", "items": [
                {"time": time or "16:00", "title": "Ceremony", "description": "Please arrive a little early to be seated."},
                {"time": "17:00", "title": "Aperitivo", "description": "Drinks and light bites in the garden."},
                {"time": "19:00", "title": "Dinner", "description": "A long table, good wine and a few toasts."},
                {"time": "22:00", "title": "Dancing", "description": "Until late."},
            ]}},
            {"type": "gallery", "props": {"images": gallery}},
            {"type": "countdown", "props": {"eyebrow": "Counting down", "heading": "See you soon", "targetDate": target}},
            {"type": "map", "props": {"eyebrow": "Getting there", "heading": "The venue", "venue": venue, "address": address or city, "mapQuery": address or place}},
            {"type": "quote", "props": {"quote": "Whatever our souls are made of, his and mine are the same.", "attribution": "Emily Brontë"}},
            {"type": "rsvp", "props": {"eyebrow": "RSVP", "heading": "Will you join us?", "body": "Kindly reply by the date below so we can plan the day around you.", "note": "Please respond by " + (date or "the date on your invitation") + ".", "buttonLabel": "Send RSVP"}},
            {"type": "footer", "props": {"heading": heading, "body": (date + (" · " + city if city else "")) if date else city}},
        ]

    if event_type == "birthday":
        age = str(brief.get("age") or "").strip()
        name = hosts or "A birthday"
        heading = f"{name} turns {age}" if age else f"{name}'s birthday"
        return [
            {"type": "hero", "props": {"eyebrow": "You're invited", "heading": heading, "subheading": desc or "An evening of good food, better company and a little bit of dancing.", "date": date, "venue": place, "image": img(0), "buttonLabel": "I'll be there"}},
            {"type": "event_details", "props": {"eyebrow": "Details", "heading": "When & where", "details": common_details + [{"label": "Dress code", "value": dress or "Come as you are", "note": None}]}},
            {"type": "schedule", "props": {"eyebrow": "Program", "heading": "The plan", "items": [
                {"time": time or "19:00", "title": "Arrivals & drinks"},
                {"time": "20:00", "title": "Dinner"},
                {"time": "21:30", "title": "Cake & a few words"},
                {"time": "22:00", "title": "Music"},
            ]}},
            {"type": "gallery", "props": {"images": gallery}},
            {"type": "countdown", "props": {"eyebrow": "Countdown", "heading": "Not long now", "targetDate": target}},
            {"type": "map", "props": {"eyebrow": "Location", "heading": "Find us", "venue": venue, "address": address or city, "mapQuery": address or place}},
            {"type": "rsvp", "props": {"eyebrow": "RSVP", "heading": "Can you make it?", "body": "Let us know if you're coming and how many of you there will be.", "buttonLabel": "Send reply"}},
            {"type": "footer", "props": {"heading": name, "body": date}},
        ]

    if event_type == "corporate":
        return [
            {"type": "hero", "props": {"eyebrow": hosts or "Presents", "heading": title or "Annual Summit", "subheading": desc or "A day of ideas, conversation and the people shaping what comes next.", "date": date, "venue": place, "image": img(0), "buttonLabel": "Register"}},
            {"type": "story", "props": {"eyebrow": "About", "heading": "Why we're gathering", "body": desc or "Bringing together practitioners and leaders for focused sessions, honest conversation and time to connect.", "image": img(1)}},
            {"type": "event_details", "props": {"eyebrow": "Details", "heading": "At a glance", "details": common_details + [{"label": "Format", "value": "In person", "note": "Registration required"}]}},
            {"type": "speakers", "props": {"eyebrow": "Speakers", "heading": "Voices on stage", "speakers": [
                {"name": "Speaker name", "role": "Title, Company"}, {"name": "Speaker name", "role": "Title, Company"},
                {"name": "Speaker name", "role": "Title, Company"}, {"name": "Speaker name", "role": "Title, Company"},
            ]}},
            {"type": "schedule", "props": {"eyebrow": "Agenda", "heading": "Schedule", "items": [
                {"time": time or "09:00", "title": "Registration & coffee"},
                {"time": "10:00", "title": "Opening keynote"},
                {"time": "11:30", "title": "Sessions"},
                {"time": "13:00", "title": "Lunch"},
                {"time": "14:30", "title": "Panel discussion"},
                {"time": "17:00", "title": "Reception"},
            ]}},
            {"type": "map", "props": {"eyebrow": "Venue", "heading": "Getting there", "venue": venue, "address": address or city, "mapQuery": address or place}},
            {"type": "rsvp", "props": {"eyebrow": "Registration", "heading": "Reserve your seat", "body": "Places are limited. Register to receive joining details.", "buttonLabel": "Register"}},
            {"type": "footer", "props": {"heading": hosts or title, "body": date}},
        ]

    if event_type == "baby_shower":
        return [
            {"type": "hero", "props": {"eyebrow": "A little one is on the way", "heading": title or f"{hosts}'s baby shower", "subheading": desc or "Join us for an afternoon of tea, cake and good wishes.", "date": date, "venue": place, "image": img(0), "buttonLabel": "RSVP"}},
            {"type": "event_details", "props": {"eyebrow": "Details", "heading": "When & where", "details": common_details}},
            {"type": "story", "props": {"eyebrow": "A note", "heading": "Before the baby arrives", "body": desc or "We'd love to celebrate with the people who mean the most to us before life gets a little louder.", "image": img(1)}},
            {"type": "gallery", "props": {"images": gallery}},
            {"type": "map", "props": {"eyebrow": "Location", "heading": "Find us", "venue": venue, "address": address or city, "mapQuery": address or place}},
            {"type": "rsvp", "props": {"eyebrow": "RSVP", "heading": "Will you come?", "body": "Let us know so we can save you a seat.", "buttonLabel": "Send reply"}},
            {"type": "footer", "props": {"heading": hosts or title, "body": date}},
        ]

    # party / other
    return [
        {"type": "hero", "props": {"eyebrow": hosts or "You're invited", "heading": title or "A gathering", "subheading": desc or "Come for the evening, stay for the conversation.", "date": date, "venue": place, "image": img(0), "buttonLabel": "RSVP"}},
        {"type": "event_details", "props": {"eyebrow": "Details", "heading": "When & where", "details": common_details + ([{"label": "Dress code", "value": dress, "note": None}] if dress else [])}},
        {"type": "schedule", "props": {"eyebrow": "Program", "heading": "The evening", "items": [
            {"time": time or "20:00", "title": "Doors open"}, {"time": "21:00", "title": "Music"}, {"time": "00:00", "title": "Late"},
        ]}},
        {"type": "gallery", "props": {"images": gallery}},
        {"type": "map", "props": {"eyebrow": "Location", "heading": "Find us", "venue": venue, "address": address or city, "mapQuery": address or place}},
        {"type": "rsvp", "props": {"eyebrow": "RSVP", "heading": "Are you in?", "body": "Reply so we know how many to expect.", "buttonLabel": "Send reply"}},
        {"type": "footer", "props": {"heading": title or hosts, "body": date}},
    ]
