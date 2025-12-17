from typing import Any, Dict


def build_business_context(db) -> Dict[str, Any]:
    """
    Build a small business context from the DB for use by `think()`.
    This is intentionally minimal — expand as needed.
    """
    ctx = {
        "staff_count": 0,
        "departments": [],
    }

    try:
        # Attempt to read staff basic info if the models are available
        from . import models

        staff_q = db.query(models.Staff).all()
        ctx["staff_count"] = len(staff_q)
        # unique departments
        depts = sorted({(s.department or "").strip() for s in staff_q if (s.department or "").strip()})
        ctx["departments"] = depts
    except Exception:
        # If DB isn't reachable or models change, return minimal context
        pass

    return ctx
