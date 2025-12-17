"""Small test script to create and list a Staff row for quick verification.

Run with: python app/test_db.py
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .models import Base, Staff

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./alfred.db")
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine)


def main():
    # ensure tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # create a test staff
        s = Staff(full_name="Test Person", role="Tester", department="QA", status="active", current_daily_rate=123.45)
        db.add(s)
        db.commit()
        db.refresh(s)

        print(f"Inserted staff id={s.id} name={s.full_name}")

        # list all staff
        rows = db.query(Staff).all()
        print(f"Total staff rows: {len(rows)}")
        for r in rows:
            print(f"- {r.id}: {r.full_name} | {r.department} | {r.current_daily_rate}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
