from typing import Tuple
from sqlalchemy.orm import Session
from . import models


HELP_TEXT = """Command mode (type commands starting with '/'):
/help
/add_staff Full Name | Role | Department | DailyRate
/adjust_salary Full Name | NewDailyRate
/list_staff
/list_staff DepartmentName

Examples:
  /add_staff Olive Grace Perez | Warehouse Supervisor | Warehouse | 585
  /adjust_salary Olive Grace Perez | 585
  /list_staff
  /list_staff Warehouse
"""


def _split_args(raw: str) -> list[str]:
    """
    Split arguments using '|' as separator and strip spaces.
    """
    return [part.strip() for part in raw.split("|") if part.strip()]


def handle_command(raw: str, db: Session) -> Tuple[str, bool]:
    """
    Handle a command-line style message.
    Returns (reply_text, handled_bool).

    If handled_bool is False, caller should treat it as normal chat.
    """
    text = raw.strip()
    if not text.startswith("/"):
        return "", False

    # Extract command and rest
    parts = text.split(" ", 1)
    cmd = parts[0].lower()          # e.g. /add_staff
    arg_str = parts[1].strip() if len(parts) > 1 else ""

    # /help
    if cmd in ("/help", "/h", "/?"):
        return HELP_TEXT, True

    # /add_staff Full Name | Role | Department | DailyRate
    if cmd == "/add_staff":
        args = _split_args(arg_str)
        if len(args) < 4:
            return ("Usage:\n/add_staff Full Name | Role | Department | DailyRate\n"
                    "Example:\n/add_staff Olive Grace Perez | Warehouse Supervisor | Warehouse | 585"), True

        full_name, role, department, rate_str = args[:4]
        try:
            rate = float(rate_str)
        except ValueError:
            return f"Invalid DailyRate value: '{rate_str}'. Please enter a number, e.g., 585", True

        staff = models.Staff(
            full_name=full_name,
            role=role,
            department=department,
            status="active",
            current_daily_rate=rate,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)

        return (f"✅ Added staff:\n"
                f"- ID: {staff.id}\n"
                f"- Name: {staff.full_name}\n"
                f"- Role: {staff.role}\n"
                f"- Department: {staff.department}\n"
                f"- Daily rate: {staff.current_daily_rate:.2f} PHP"), True

    # /adjust_salary Full Name | NewDailyRate
    if cmd == "/adjust_salary":
        args = _split_args(arg_str)
        if len(args) < 2:
            return ("Usage:\n/adjust_salary Full Name | NewDailyRate\n"
                    "Example:\n/adjust_salary Olive Grace Perez | 585"), True

        full_name, rate_str = args[:2]
        try:
            new_rate = float(rate_str)
        except ValueError:
            return f"Invalid NewDailyRate value: '{rate_str}'. Please enter a number, e.g., 585", True

        staff = (
            db.query(models.Staff)
            .filter(models.Staff.full_name.ilike(full_name))
            .first()
        )

        if not staff:
            return f"⚠️ No staff found with name '{full_name}'.", True

        old_rate = staff.current_daily_rate
        staff.current_daily_rate = new_rate
        db.commit()

        return (f"✅ Updated salary for {staff.full_name}:\n"
                f"- Old daily rate: {old_rate if old_rate is not None else 'n/a'}\n"
                f"- New daily rate: {new_rate:.2f} PHP"), True

    # /list_staff [Department]
    if cmd == "/list_staff":
        if arg_str:
            dept = arg_str.strip()
            staff_list = (
                db.query(models.Staff)
                .filter(models.Staff.department.ilike(dept))
                .all()
            )
            header = f"Staff in department '{dept}':"
        else:
            staff_list = db.query(models.Staff).all()
            header = "All staff:"

        if not staff_list:
            return f"{header}\n(no records found)", True

        lines = [header]
        for s in staff_list:
            lines.append(
                f"- {s.full_name} | Role: {s.role}"
                + (f" | Dept: {s.department}" if s.department else "")
                + (f" | Daily rate: {s.current_daily_rate:.2f} PHP" if s.current_daily_rate else "")
                + (f" | Status: {s.status}" if s.status else "")
            )
        return "\n".join(lines), True

    # Unknown command
    return f"Unknown command: {cmd}\nType /help for list of commands.", True
