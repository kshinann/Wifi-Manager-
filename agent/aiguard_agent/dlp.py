"""Detects sensitive data in prompts before they are sent to an AI tool."""

import re

_PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]?){13,19}\b"),
    "phone": re.compile(r"(?<!\d)(?:\+?\d{1,3}[ -]?)?(?:\(?\d{2,4}\)?[ -]?)\d{3,4}[ -]?\d{4}(?!\d)"),
    "api_key": re.compile(
        r"\b(?:sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}"
        r"|gh[pousr]_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,})\b"
    ),
    # Malaysian MyKad / NRIC: YYMMDD-PB-###G
    "my_nric": re.compile(r"\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}\b"),
    "ip_address": re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b"),
    "iban": re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b"),
}


def _luhn_ok(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def scan(text: str, detectors: list[str], keywords: list[str]) -> list[str]:
    """Return the names of detectors and keywords that matched, e.g. ["credit_card", "keyword:project x"]."""
    hits: list[str] = []
    for name in detectors:
        pattern = _PATTERNS.get(name)
        if pattern is None:
            continue
        matches = pattern.findall(text)
        if name == "credit_card":
            matches = [m for m in matches if _luhn_ok(m)]
        if matches:
            hits.append(name)
    lowered = text.lower()
    for word in keywords:
        word = word.strip().lower()
        if word and word in lowered:
            hits.append(f"keyword:{word}")
    return hits
