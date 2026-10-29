"""Detects and masks sensitive data in prompts before they leave the PC."""

import re
from collections.abc import Callable

# Words that introduce a secret: "password: x", "pin = 1234", "TAC - 123456", "kata laluan: x".
_SECRET_WORDS = r"password|passwd|passcode|passphrase|pwd|pw|p/w|pass|pin|cvv2?|cvc|otp|tac|kata\s*laluan|katalaluan"
# Words that may be followed by the secret without a separator ("password Abc12345").
_SECRET_WORDS_BARE = r"password|passwd|passcode|pwd|pin|otp|tac|kata\s*laluan|katalaluan"
# Context that marks a nearby long number as a bank account.
_BANK_WORDS = (
    r"acc(?:oun)?t?|a/c|akaun|bank|maybank|cimb|public\s*bank|pbb|rhb|hong\s*leong|hlb|ambank|bank\s*islam|bsn"
    r"|affin|alliance|uob|ocbc|hsbc|standard\s*chartered|bank\s*rakyat|agrobank|muamalat|mbsb|swift|routing"
    r"|sort\s*code|beneficiary|penerima"
)

# A secret value: everything up to whitespace, leaving trailing punctuation such as "," in place.
_VALUE = r"\S+?(?=[,;.)]?(?:\s|$))"

Replacer = Callable[[re.Match], "str | None"]  # returns None when the match is not really sensitive


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


def _card(m: re.Match) -> str | None:
    if not _luhn_ok(m.group(0)):
        return None
    last4 = re.sub(r"\D", "", m.group(0))[-4:]
    return f"[CARD ****{last4}]"


def _fixed(label: str) -> Replacer:
    return lambda m: label


# Each detector is a list of (pattern, replacer). Masking keeps the label ("password: ********") so a
# reviewer can see what kind of data was shared without seeing the value.
_RULES: dict[str, list[tuple[re.Pattern, Replacer]]] = {
    "credentials": [
        (re.compile(r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )?PRIVATE KEY-----|\Z)"),
         _fixed("[PRIVATE KEY]")),
        (re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)[^\s:/@]+:[^\s@/]+@"), lambda m: f"{m.group(1)}[CREDENTIALS]@"),
        (re.compile(rf"(?i)\b({_SECRET_WORDS})\b(\s*(?:is\b|[:=\-\u2013\u2014>]+)\s*){_VALUE}"),
         lambda m: f"{m.group(1)}{m.group(2)}********"),
        # Bare value only when it contains a digit, so "password policy" does not match.
        (re.compile(rf"(?i)\b({_SECRET_WORDS_BARE})\b(\s+)(?=\S*\d)(?=\S{{6}}){_VALUE}"),
         lambda m: f"{m.group(1)}{m.group(2)}********"),
    ],
    "api_key": [(re.compile(
        r"\b(?:sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}"
        r"|gh[pousr]_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,})\b"), _fixed("[API KEY]"))],
    "credit_card": [(re.compile(r"\b\d(?:[ -]?\d){12,18}\b"), _card)],
    # 8-20 digit number within a few words after a bank/account word: "Maybank acc no: 5140 1234 5678".
    "bank_account": [(re.compile(rf"(?i)\b({_BANK_WORDS})\b([^\d\n]{{0,25}}?)\d(?:[ -]?\d){{7,19}}\b"),
                      lambda m: f"{m.group(1)}{m.group(2)}[BANK ACCOUNT]")],
    "iban": [(re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b"), _fixed("[IBAN]"))],
    # Malaysian MyKad / NRIC: YYMMDD-PB-###G
    "my_nric": [(re.compile(r"\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}\b"), _fixed("[MYKAD]"))],
    "phone": [(re.compile(r"(?<!\d)(?:\+?\d{1,3}[ -]?)?(?:\(?\d{2,4}\)?[ -]?)\d{3,4}[ -]?\d{4}(?!\d)"),
               _fixed("[PHONE]"))],
    "email": [(re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), _fixed("[EMAIL]"))],
    "ip_address": [(re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b"),
                    _fixed("[IP]"))],
}

# Masking order: specific formats first so a card or bank number is not relabelled as a phone number.
_MASK_ORDER = list(_RULES)
# Never stored in clear text, even when the policy does not alert on them.
ALWAYS_MASK = {"credentials", "api_key", "credit_card", "bank_account", "iban", "my_nric"}


LABELS = {
    "credentials": "a password or login credential", "api_key": "an API key or secret", "credit_card": "a card number",
    "bank_account": "a bank account number", "iban": "a bank account number (IBAN)", "my_nric": "an IC (MyKad) number",
    "phone": "a phone number", "email": "an email address", "ip_address": "an IP address",
}


def describe(hits: list[str]) -> str:
    """Human-readable list for the warning shown to the user."""
    names = list(dict.fromkeys("a restricted keyword" if h.startswith("keyword:") else LABELS.get(h, h) for h in hits))
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def _keyword_patterns(keywords: list[str]) -> list[re.Pattern]:
    return [re.compile(re.escape(k.strip()), re.I) for k in keywords if k.strip()]


def scan(text: str, detectors: list[str], keywords: list[str]) -> list[str]:
    """Return the names of detectors and keywords that matched, e.g. ["credit_card", "keyword:project x"]."""
    hits: list[str] = []
    for name in detectors:
        for pattern, replacer in _RULES.get(name, []):
            if any(replacer(m) is not None for m in pattern.finditer(text)):
                hits.append(name)
                break
    for word, pattern in zip([k.strip().lower() for k in keywords if k.strip()], _keyword_patterns(keywords)):
        if pattern.search(text):
            hits.append(f"keyword:{word}")
    return hits


def mask(text: str, detectors: list[str], keywords: list[str]) -> str:
    """Replace sensitive values with placeholders such as "password: ********" or "[CARD ****1111]"."""
    enabled = ALWAYS_MASK | set(detectors)
    for name in _MASK_ORDER:
        if name not in enabled:
            continue
        for pattern, replacer in _RULES[name]:
            text = pattern.sub(lambda m: replacer(m) or m.group(0), text)
    for pattern in _keyword_patterns(keywords):
        text = pattern.sub("[KEYWORD]", text)
    return text
