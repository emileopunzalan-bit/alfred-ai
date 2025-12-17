from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from alfred.app.models import Base, Staff
from alfred.app.business_context import build_business_context


def test_build_business_context_counts_depts():
    engine = create_engine("sqlite:///:memory:", echo=False, future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    db = Session()
    try:
        # seed some staff
        s1 = Staff(full_name="A", department="Sales")
        s2 = Staff(full_name="B", department="Sales")
        s3 = Staff(full_name="C", department="Warehouse")
        db.add_all([s1, s2, s3])
        db.commit()

        ctx = build_business_context(db)
        assert ctx["staff_count"] == 3
        assert "Sales" in ctx["departments"]
        assert "Warehouse" in ctx["departments"]
    finally:
        db.close()
