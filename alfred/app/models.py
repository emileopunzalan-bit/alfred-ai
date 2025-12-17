from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime, UTC

Base = declarative_base()


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False, index=True)
    role = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True, index=True)
    status = Column(String(50), nullable=True, default="active")
    current_daily_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    def __repr__(self) -> str:  # pragma: no cover - convenience
        return f"<Staff id={self.id} name={self.full_name!r}>"
