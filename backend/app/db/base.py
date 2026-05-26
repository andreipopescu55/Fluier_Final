# Acest fisier importa Base + toate modelele intr-un singur loc.
# Este folosit exclusiv de Alembic in env.py (vezi alembic/env.py).
# Scopul: Alembic trebuie sa cunoasca toate modelele inainte sa genereze migratii.
from app.db.base_class import Base  # noqa: F401
import app.models  # noqa: F401 - importul declansează inregistrarea modelelor in Base
