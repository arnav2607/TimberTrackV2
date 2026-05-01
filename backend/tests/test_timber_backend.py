"""End-to-end backend tests for TimberLog FastAPI app.

Covers:
- Auth (signup/login/me) including duplicates and bad creds
- Purchases CRUD (list/create/get/update/delete with cascade)
- Containers (get, delete with constraint)
- Measurements (bulk-save with calc, clear, mark complete, toggle complete)
- Dashboard summary (filters, totals, countries)
- User isolation (userA cannot access userB's data)
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Read from frontend/.env as fallback (testing context)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------

def _new_username(prefix="t"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    uname = _new_username("a")
    r = session.post(f"{API}/auth/signup", json={
        "full_name": "User A",
        "username": uname,
        "password": "pass1234",
        "company_name": "Company A",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"username": uname.lower(), "token": data["token"], "id": data["user"]["id"]}


@pytest.fixture(scope="module")
def user_b(session):
    uname = _new_username("b")
    r = session.post(f"{API}/auth/signup", json={
        "full_name": "User B",
        "username": uname,
        "password": "pass1234",
        "company_name": "Company B",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"username": uname.lower(), "token": data["token"], "id": data["user"]["id"]}


def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------

class TestAuth:
    def test_signup_returns_token_and_user(self, session, user_a):
        assert user_a["token"]
        assert user_a["id"]
        # backend lowercases username
        assert user_a["username"] == user_a["username"].lower()

    def test_signup_duplicate_username(self, session, user_a):
        r = session.post(f"{API}/auth/signup", json={
            "full_name": "Dup",
            "username": user_a["username"],
            "password": "pass1234",
            "company_name": "X",
        })
        assert r.status_code == 400
        assert "taken" in r.json().get("detail", "").lower() or "exists" in r.json().get("detail", "").lower()

    def test_login_correct(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={
            "username": user_a["username"], "password": "pass1234"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["token"]
        assert body["user"]["username"] == user_a["username"]

    def test_login_wrong(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={
            "username": user_a["username"], "password": "wrong"
        })
        assert r.status_code == 401

    def test_me_with_token(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["username"] == user_a["username"]

    def test_me_missing_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self, session):
        r = session.get(f"{API}/auth/me", headers=auth_h("not-a-jwt"))
        assert r.status_code == 401


# ---------- Purchases ----------

@pytest.fixture(scope="module")
def purchase_a(session, user_a):
    bl = f"TEST_BL_{uuid.uuid4().hex[:6]}"
    r = session.post(f"{API}/purchases", json={
        "bl_number": bl,
        "bl_date": "2025-01-15",
        "supplier_name": "Acme Timbers",
        "country": "Myanmar",
        "remarks": "rmk",
        "containers": [
            {"container_number": "CN-A1"},
            {"container_number": "CN-A2"},
        ],
    }, headers=auth_h(user_a["token"]))
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    return {"id": pid, "bl_number": bl}


class TestPurchases:
    def test_create_requires_container(self, session, user_a):
        r = session.post(f"{API}/purchases", json={
            "bl_number": f"TEST_BL_{uuid.uuid4().hex[:6]}",
            "bl_date": "2025-01-01", "supplier_name": "S", "country": "X",
            "containers": [],
        }, headers=auth_h(user_a["token"]))
        assert r.status_code == 400

    def test_create_duplicate_bl(self, session, user_a, purchase_a):
        r = session.post(f"{API}/purchases", json={
            "bl_number": purchase_a["bl_number"],
            "bl_date": "2025-02-01", "supplier_name": "S", "country": "X",
            "containers": [{"container_number": "X"}],
        }, headers=auth_h(user_a["token"]))
        assert r.status_code == 400

    def test_list_only_own(self, session, user_a, user_b, purchase_a):
        ra = session.get(f"{API}/purchases", headers=auth_h(user_a["token"]))
        assert ra.status_code == 200
        a_bls = [p["bl_number"] for p in ra.json()]
        assert purchase_a["bl_number"] in a_bls
        for p in ra.json():
            assert "containers" in p
            assert "total_containers" in p
            assert "completed_containers" in p
            assert "status" in p

        rb = session.get(f"{API}/purchases", headers=auth_h(user_b["token"]))
        assert rb.status_code == 200
        b_bls = [p["bl_number"] for p in rb.json()]
        assert purchase_a["bl_number"] not in b_bls

    def test_get_purchase_with_containers(self, session, user_a, purchase_a):
        r = session.get(f"{API}/purchases/{purchase_a['id']}", headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["bl_number"] == purchase_a["bl_number"]
        assert len(body["containers"]) == 2
        sr_nos = sorted(c["sr_no"] for c in body["containers"])
        assert sr_nos == [1, 2]
        for c in body["containers"]:
            assert "log_count" in c and "status" in c
            assert c["status"] == "pending"

    def test_get_purchase_user_b_isolated(self, session, user_b, purchase_a):
        r = session.get(f"{API}/purchases/{purchase_a['id']}", headers=auth_h(user_b["token"]))
        assert r.status_code == 404

    def test_update_and_add_containers(self, session, user_a, purchase_a):
        r = session.patch(f"{API}/purchases/{purchase_a['id']}", json={
            "supplier_name": "Updated Supplier",
            "new_containers": [{"container_number": "CN-A3"}],
        }, headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        # verify
        r2 = session.get(f"{API}/purchases/{purchase_a['id']}", headers=auth_h(user_a["token"]))
        body = r2.json()
        assert body["supplier_name"] == "Updated Supplier"
        assert len(body["containers"]) == 3
        sr_nos = sorted(c["sr_no"] for c in body["containers"])
        assert sr_nos == [1, 2, 3]


# ---------- Container measurements ----------

@pytest.fixture(scope="module")
def container_a(session, user_a, purchase_a):
    r = session.get(f"{API}/purchases/{purchase_a['id']}", headers=auth_h(user_a["token"]))
    body = r.json()
    return body["containers"][0]  # first container (sr_no 1)


class TestMeasurements:
    def test_get_container_initial(self, session, user_a, container_a):
        r = session.get(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "pending"
        assert body["measurements"] == []
        assert body["purchase"]["id"] == container_a["purchase_id"]

    def test_user_b_cannot_access_container(self, session, user_b, container_a):
        r = session.get(f"{API}/containers/{container_a['id']}", headers=auth_h(user_b["token"]))
        assert r.status_code == 404

    def test_save_measurements_with_calc(self, session, user_a, container_a):
        # Verify formulas
        m = {"le1": 300, "l": 290, "g1": 80, "g2": 78}
        # CBM1 = 300*80*80/16000000 = 0.12
        # CBM2 = 290*78*78/16000000 = 0.110205
        # CFT1 = 0.12 * 35.315 = 4.2378
        r = session.post(f"{API}/containers/{container_a['id']}/measurements", json={
            "measurements": [m, {"le1": 250, "l": 245, "g1": 70, "g2": 68}],
            "mark_complete": False,
        }, headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["saved"] == 2

        # GET to verify persisted with computed fields
        g = session.get(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        gb = g.json()
        logs = gb["measurements"]
        assert len(logs) == 2
        log1 = logs[0]
        assert log1["log_number"] == 1
        assert log1["cbm1"] == pytest.approx(0.12, rel=1e-3)
        assert log1["cbm2"] == pytest.approx(290 * 78 * 78 / 16000000, rel=1e-3)
        assert log1["cft1"] == pytest.approx(0.12 * 35.315, rel=1e-3)
        assert log1["cft2"] == pytest.approx(log1["cbm2"] * 35.315, rel=1e-3)
        assert gb["status"] == "in_progress"

    def test_delete_with_measurements_rejected(self, session, user_a, container_a):
        r = session.delete(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        assert r.status_code == 400

    def test_save_more_increments_log_number(self, session, user_a, container_a):
        r = session.post(f"{API}/containers/{container_a['id']}/measurements", json={
            "measurements": [{"le1": 200, "l": 195, "g1": 60, "g2": 58}],
            "mark_complete": True,
        }, headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        g = session.get(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        gb = g.json()
        assert len(gb["measurements"]) == 3
        log_nums = [lg["log_number"] for lg in gb["measurements"]]
        assert log_nums == [1, 2, 3]
        assert gb["is_loading_complete"] is True
        assert gb["status"] == "completed"

    def test_toggle_complete_off(self, session, user_a, container_a):
        r = session.patch(f"{API}/containers/{container_a['id']}/complete",
                          json={"is_complete": False}, headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        g = session.get(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        gb = g.json()
        assert gb["is_loading_complete"] is False
        assert gb["status"] == "in_progress"

    def test_clear_measurements(self, session, user_a, container_a):
        r = session.delete(f"{API}/containers/{container_a['id']}/measurements",
                           headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        g = session.get(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        gb = g.json()
        assert gb["measurements"] == []
        assert gb["is_loading_complete"] is False
        assert gb["status"] == "pending"

    def test_delete_empty_container_succeeds(self, session, user_a, container_a):
        r = session.delete(f"{API}/containers/{container_a['id']}", headers=auth_h(user_a["token"]))
        assert r.status_code == 200


# ---------- Dashboard ----------

class TestDashboard:
    def test_summary_basic(self, session, user_a, purchase_a):
        # add some measurements to a different container for totals
        # fetch purchase, pick second container
        gp = session.get(f"{API}/purchases/{purchase_a['id']}", headers=auth_h(user_a["token"])).json()
        c = gp["containers"][0]  # sr_no 2 now (sr_no 1 was deleted)
        session.post(f"{API}/containers/{c['id']}/measurements", json={
            "measurements": [{"le1": 300, "l": 290, "g1": 80, "g2": 78}],
            "mark_complete": True,
        }, headers=auth_h(user_a["token"]))

        r = session.get(f"{API}/dashboard/summary", headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        body = r.json()
        assert "purchases" in body and "grand_totals" in body and "countries" in body
        assert body["grand_totals"]["bls"] >= 1
        assert body["grand_totals"]["pieces"] >= 1
        assert "Myanmar" in body["countries"]
        # nested containers w/ totals + measurements
        for p in body["purchases"]:
            assert "totals" in p
            for cont in p["containers"]:
                assert "totals" in cont
                assert "measurements" in cont
                assert "status" in cont

    def test_summary_filters(self, session, user_a, purchase_a):
        # bl_search filter
        r = session.get(f"{API}/dashboard/summary",
                        params={"bl_search": purchase_a["bl_number"][:8]},
                        headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        bls = [p["bl_number"] for p in r.json()["purchases"]]
        assert purchase_a["bl_number"] in bls

        # country filter
        r = session.get(f"{API}/dashboard/summary",
                        params={"country": "Myanmar"}, headers=auth_h(user_a["token"]))
        assert r.status_code == 200

        # date range no match
        r = session.get(f"{API}/dashboard/summary",
                        params={"date_from": "2099-01-01"}, headers=auth_h(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["grand_totals"]["bls"] == 0

    def test_summary_user_b_isolated(self, session, user_b, purchase_a):
        r = session.get(f"{API}/dashboard/summary", headers=auth_h(user_b["token"]))
        assert r.status_code == 200
        bls = [p["bl_number"] for p in r.json()["purchases"]]
        assert purchase_a["bl_number"] not in bls


# ---------- Cascade delete ----------

class TestCascadeDelete:
    def test_delete_purchase_cascades(self, session, user_a):
        # Create dedicated purchase
        bl = f"TEST_DEL_{uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/purchases", json={
            "bl_number": bl, "bl_date": "2025-03-01",
            "supplier_name": "S", "country": "Ghana",
            "containers": [{"container_number": "DC-1"}],
        }, headers=auth_h(user_a["token"]))
        pid = r.json()["id"]
        # add measurements
        gp = session.get(f"{API}/purchases/{pid}", headers=auth_h(user_a["token"])).json()
        cid = gp["containers"][0]["id"]
        session.post(f"{API}/containers/{cid}/measurements", json={
            "measurements": [{"le1": 100, "l": 95, "g1": 50, "g2": 49}],
            "mark_complete": False,
        }, headers=auth_h(user_a["token"]))
        # delete
        d = session.delete(f"{API}/purchases/{pid}", headers=auth_h(user_a["token"]))
        assert d.status_code == 200
        # verify gone
        g = session.get(f"{API}/purchases/{pid}", headers=auth_h(user_a["token"]))
        assert g.status_code == 404
        gc = session.get(f"{API}/containers/{cid}", headers=auth_h(user_a["token"]))
        assert gc.status_code == 404
