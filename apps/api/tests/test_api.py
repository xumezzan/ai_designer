import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["LOCAL_STORAGE_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
client.__enter__()  # run lifespan (creates tables)


def _auth():
    r = client.post("/api/auth/signup", json={"email": "t@example.com", "password": "secret123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_full_flow():
    h = _auth()
    p = client.post("/api/projects", headers=h, json={"name": "Test wedding", "event_type": "wedding", "brief": {"hosts": "A & B", "description": "minimal ivory olive"}}).json()
    gen = client.post(f"/api/projects/{p['id']}/ai/generate-design", headers=h).json()
    assert gen["status"] == "done" and len(gen["concepts"]) == 3
    p = client.post(f"/api/projects/{p['id']}/ai/select-concept", headers=h, json={"generation_id": gen["id"], "index": 1}).json()
    assert p["design"]["meta"]["conceptName"] == "Concept 02"

    edit = client.post(f"/api/projects/{p['id']}/ai/edit-design", headers=h, json={"prompt": "make it more minimal"}).json()
    assert edit["operations"]

    # invalid design is rejected
    bad = client.put(f"/api/projects/{p['id']}/design", headers=h, json={"design": {"foo": 1}})
    assert bad.status_code == 422

    pub = client.post(f"/api/projects/{p['id']}/publish", headers=h, json={"slug": "a-and-b"}).json()
    assert pub["is_live"] and pub["slug"] == "a-and-b"
    site = client.get("/api/public/sites/a-and-b").json()
    assert site["design"]["sections"][0]["type"] == "hero"

    r = client.post("/api/public/sites/a-and-b/rsvp", json={"name": "Guest", "guests": 2, "attending": True})
    assert r.status_code == 200
    stats = client.get(f"/api/projects/{p['id']}/rsvps/stats", headers=h).json()
    assert stats["confirmed"] == 2

    client.delete(f"/api/projects/{p['id']}/publish", headers=h)
    assert client.get("/api/public/sites/a-and-b").status_code == 404

    # password protection
    client.post(f"/api/projects/{p['id']}/publish", headers=h, json={"slug": "a-and-b", "password": "pw"})
    assert client.get("/api/public/sites/a-and-b").status_code == 401
    assert client.get("/api/public/sites/a-and-b", headers={"X-Site-Password": "pw"}).status_code == 200

    assert client.get("/api/public/showcase").json()


def test_auth_required():
    assert client.get("/api/projects").status_code == 401
