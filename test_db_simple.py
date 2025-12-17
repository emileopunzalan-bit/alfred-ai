#!/usr/bin/env python3
"""
Simple standalone test script to insert and list a Staff row.
Run from the ProjectAL root directory: python test_db_simple.py
"""
import sys
import os

# Add the current directory to Python path so we can import alfred package
sys.path.insert(0, os.getcwd())

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from alfred.app.models import Base, Staff

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./alfred.db")
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine)


def main():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created/verified.\n")

    db = SessionLocal()
    try:
        # Clear old test data (optional)
        # db.query(Staff).delete()
        # db.commit()

        # Insert test staff
        print("Inserting test staff...")
        s = Staff(
            full_name="Olive Grace Perez",
            role="Warehouse Supervisor",
            department="Warehouse",
            status="active",
            current_daily_rate=585.00,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        print(f"✓ Inserted staff: id={s.id}, name={s.full_name}\n")

        # List all staff
        print("Listing all staff:")
        rows = db.query(Staff).all()
        print(f"Total staff rows: {len(rows)}\n")
        for r in rows:
            print(
                f"  - [{r.id}] {r.full_name:30s} | Role: {r.role:25s} | Dept: {r.department:15s} | Rate: {r.current_daily_rate:.2f} PHP"
            )
        print("\n✓ DB test complete!")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
