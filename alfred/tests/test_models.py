import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from alfred.app.models import Base, Staff


def test_create_staff_in_memory_db():
    """Smoke test: create tables, insert a Staff row, and query it."""
    engine = create_engine("sqlite:///:memory:", echo=False, future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    db = Session()
    try:
        s = Staff(
            full_name="Test User",
            role="Tester",
            department="QA",
            status="active",
            current_daily_rate=100.0,
        )
        db.add(s)
        db.commit()
        db.refresh(s)

        assert s.id is not None

        fetched = db.query(Staff).filter_by(id=s.id).one()
        assert fetched.full_name == "Test User"
        assert fetched.department == "QA"
        assert abs(fetched.current_daily_rate - 100.0) < 1e-6
    finally:
        db.close()
