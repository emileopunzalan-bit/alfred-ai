import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure tests import the app with an in-memory sqlite DB by default
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
# Force dev mode for OpenAI client to avoid real API calls during tests
os.environ.pop("OPENAI_API_KEY", None)

from alfred.app import main as app_module
from alfred.app.models import Base, Staff


def make_inmemory_session():
    # Use a temporary file-backed SQLite DB so the TestClient (which may use threads)
    # can see the same schema/rows across connections.
    import tempfile
    tmp = tempfile.NamedTemporaryFile(prefix="pytest_db_", suffix=".db", delete=False)
    tmp_path = tmp.name
    tmp.close()
    engine = create_engine(f"sqlite:///{tmp_path}", connect_args={"check_same_thread": False}, future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session


def test_health_and_index():
    client = TestClient(app_module.app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_chat_and_commands_with_overridden_db():
    # Create in-memory DB and override dependency
    Session = make_inmemory_session()

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app_module.app.dependency_overrides[app_module.get_db] = override_get_db
    client = TestClient(app_module.app)

    # Ensure brain runs in dev mode for tests (avoid real OpenAI calls)
    try:
        import alfred.app.brain as brain
        brain.USE_REAL_OPENAI = False
        brain.client = None
    except Exception:
        pass

    # 1) Normal chat (dev mode) should reply with DEV MODE message
    resp = client.post("/chat", json={"user_id": "test", "message": "hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert "DEV MODE" in data["reply"] or "received" in data["reply"]

    # 2) Command mode: add staff
    add_cmd = "/add_staff Test Person | Tester | QA | 321"
    resp2 = client.post("/chat", json={"user_id": "test", "message": add_cmd})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert "Added staff" in data2["reply"] or "Added staff" in str(data2["reply"]) or "Added staff" in data2["reply"]

    # verify record in DB
    db = Session()
    try:
        rows = db.query(Staff).filter(Staff.full_name == "Test Person").all()
        assert len(rows) == 1
        assert rows[0].current_daily_rate == 321.0
    finally:
        db.close()

    # cleanup override
    app_module.app.dependency_overrides.pop(app_module.get_db, None)


def test_tts_endpoint_empty_and_text():
    client = TestClient(app_module.app)

    # empty text returns empty audio response
    r = client.post("/tts", json={"text": ""})
    assert r.status_code == 200
    # content may be empty
    assert r.content == b""
