from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Importam Base + toate modelele.
# Trebuie sa apara aici inainte sa setam target_metadata, altfel Alembic
# nu "vede" tabelele cand face autogenerate.
from app.db.base import Base  # noqa: F401
from app.core.config import settings

# Obiectul Config din alembic.ini
config = context.config

# Suprascriem URL-ul din .ini cu cel din settings (vine din .env).
# Avantaj: o singura sursa de adevar pentru DATABASE_URL.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Setup logging din alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata e folosit de --autogenerate ca sa compare
# modelele Python cu schema actuala din DB
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Genereaza SQL fara conexiune live (util pentru CI / inspectie)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # compare_type=True detecteaza schimbari de tip pe coloane existente
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Conecteaza-te la DB si aplica migrarile."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
