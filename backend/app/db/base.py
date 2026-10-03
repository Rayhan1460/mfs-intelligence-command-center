from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.db import models as models