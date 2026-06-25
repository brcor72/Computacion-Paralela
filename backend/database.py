"""
database.py
-----------
Configura la conexion a la base de datos SQLite y crea el motor de SQLAlchemy.
Expone: engine, SessionLocal, Base (para definir modelos ORM).
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de conexion a SQLite. El archivo se crea en el directorio de trabajo del backend.
DATABASE_URL = "sqlite:///./textile_analysis.db"

# Motor de base de datos. check_same_thread=False es necesario para SQLite con FastAPI.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Fabrica de sesiones: cada peticion HTTP abre y cierra su propia sesion.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base de la que heredan todos los modelos ORM.
Base = declarative_base()


def get_db():
    """
    Dependencia de FastAPI que provee una sesion de base de datos por peticion.
    Garantiza que la sesion se cierre al finalizar, incluso si ocurre una excepcion.

    Yields:
        db (Session): Sesion activa de SQLAlchemy.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
