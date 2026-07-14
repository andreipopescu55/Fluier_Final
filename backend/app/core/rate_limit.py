"""
Rate limiting la autentificare — prima utilizare reala a Redis din proiect.

Politica: dupa MAX_FAILED_ATTEMPTS incercari ESUATE pentru aceeasi combinatie
(IP, email) in fereastra de WINDOW_SECONDS, login-ul e blocat pana expira
fereastra. Mecanism: un contor INCR cu EXPIRE — cheia dispare singura, nu
tinem stare permanenta si nu blocam contul in DB (utilizatorul legitim isi
revine automat).

De ce Redis si nu Postgres: contorul e efemer, scris la fiecare incercare
esuata si citit la fiecare login — exact profilul unui cache in-memory, nu al
unei tabele tranzactionale.

FAIL-OPEN deliberat: daca Redis nu raspunde, login-ul functioneaza normal
(fara rate limiting). Pentru aceasta aplicatie disponibilitatea autentificarii
conteaza mai mult decat protectia anti brute-force — decizie de mentionat
onest la deployment.
"""
import redis

from app.core.config import settings

# Maxim de incercari esuate permise in fereastra, per (IP, email).
MAX_FAILED_ATTEMPTS = 5
# Fereastra de numarare / durata blocarii (secunde).
WINDOW_SECONDS = 15 * 60

# Timeout-uri scurte: daca Redis nu raspunde repede, renuntam (fail-open),
# nu tinem requestul de login blocat.
_client = redis.Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=0.5,
    socket_timeout=0.5,
)


def _key(ip: str, email: str) -> str:
    return f"login:fail:{ip}:{email.strip().lower()}"


def seconds_until_retry(ip: str, email: str) -> int:
    """
    0  -> login permis;
    >0 -> blocat inca atatea secunde (limita de incercari atinsa).
    """
    try:
        key = _key(ip, email)
        count = _client.get(key)
        if count is not None and int(count) >= MAX_FAILED_ATTEMPTS:
            return max(_client.ttl(key), 1)
        return 0
    except redis.RedisError:
        return 0  # Redis indisponibil -> fail-open


def register_failure(ip: str, email: str) -> None:
    """O incercare esuata in plus; prima porneste fereastra de expirare."""
    try:
        key = _key(ip, email)
        count = _client.incr(key)
        if count == 1:
            _client.expire(key, WINDOW_SECONDS)
    except redis.RedisError:
        pass


def reset(ip: str, email: str) -> None:
    """Login reusit -> contorul dispare (incercarile vechi nu mai conteaza)."""
    try:
        _client.delete(_key(ip, email))
    except redis.RedisError:
        pass
