from typing import Generator
from sqlalchemy.orm import Session
from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    # yield in loc de return transforma functia intr-un generator.
    # FastAPI stie sa lucreze cu generatoare ca dependinte.
    # Tot ce e inainte de yield ruleaza inainte de request.
    # Tot ce e dupa yield (finally) ruleaza dupa ce request-ul s-a terminat.
    db = SessionLocal()
    try:
        yield db  # db e injectat in endpoint
    finally:
        db.close()  # se inchide intotdeauna, chiar si daca apare o exceptie
