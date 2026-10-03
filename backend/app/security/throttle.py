from collections import defaultdict, deque
from time import monotonic

WINDOW_SECONDS = 900
MAX_FAILURES = 5
_failures: dict[str, deque[float]] = defaultdict(deque)


def is_login_throttled(key: str) -> bool:
    now = monotonic()
    attempts = _failures[key]
    while attempts and now - attempts[0] >= WINDOW_SECONDS:
        attempts.popleft()
    return len(attempts) >= MAX_FAILURES


def record_login_failure(key: str) -> None:
    _failures[key].append(monotonic())


def clear_login_failures(key: str) -> None:
    _failures.pop(key, None)


def reset_login_throttle() -> None:
    _failures.clear()