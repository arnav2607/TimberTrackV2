from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict


# ----- DB -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ----- App -----
app = FastAPI(title="Timber Management API")
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_EXPIRES_DAYS = 30

bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


# ----- Auth helpers -----
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))


def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ----- Models -----
class SignupIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: str
    username: str
    password: str
    company_name: str


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    full_name: str
    username: str
    company_name: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ContainerIn(BaseModel):
    container_number: str
    cbm_gross: Optional[float] = None
    cbm_net: Optional[float] = None
    pcs_supplier: Optional[int] = None
    l_avg: Optional[float] = None
    quality_supplier: Optional[str] = None


class PurchaseIn(BaseModel):
    bl_number: str
    bl_date: str  # ISO date string
    supplier_name: str
    country: str
    remarks: Optional[str] = ""
    containers: List[ContainerIn] = []


class PurchaseUpdateIn(BaseModel):
    bl_number: Optional[str] = None
    bl_date: Optional[str] = None
    supplier_name: Optional[str] = None
    country: Optional[str] = None
    remarks: Optional[str] = None
    new_containers: List[ContainerIn] = []


class MeasurementIn(BaseModel):
    le1: float
    l: float  # noqa: E741
    g1: float
    g2: float


class MeasurementsBulkIn(BaseModel):
    measurements: List[MeasurementIn]
    mark_complete: bool = False


class CompleteIn(BaseModel):
    is_complete: bool


class CompletionFormIn(BaseModel):
    bend_percent: Optional[float] = None
    quality_by_us: Optional[str] = None
    measurement_date: Optional[str] = None  # ISO date string


class SupplierIn(BaseModel):
    name: str


class CountryIn(BaseModel):
    name: str


# ----- Helpers -----
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def calc_log(le1: float, l: float, g1: float, g2: float) -> dict:  # noqa: E741
    cbm1 = (le1 * g1 * g1) / 16000000.0
    cbm2 = (l * g2 * g2) / 16000000.0
    return {
        "cbm1": round(cbm1, 6),
        "cbm2": round(cbm2, 6),
        "cft1": round(cbm1 * 35.315, 6),
        "cft2": round(cbm2 * 35.315, 6),
    }


def calc_avg_girth(cbm: float, pcs: int) -> float:
    """Calculate average girth: (CBM × 35.315) / PCS"""
    if pcs == 0:
        return 0.0
    return round((cbm * 35.315) / pcs, 4)


async def container_status_for(container_id: str) -> str:
    """Decide status from log_measurements + is_loading_complete."""
    cont = await db.containers.find_one({"id": container_id}, {"_id": 0})
    if not cont:
        return "pending"
    if cont.get("is_loading_complete"):
        return "completed"
    count = await db.log_measurements.count_documents({"container_id": container_id})
    if count == 0:
        return "pending"
    return "in_progress"


# ----- Auth Endpoints -----
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: SignupIn):
    uname = payload.username.strip().lower()
    if not uname or not payload.password or not payload.full_name or not payload.company_name:
        raise HTTPException(status_code=400, detail="All fields required")
    existing = await db.users.find_one({"username": uname})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "full_name": payload.full_name.strip(),
        "username": uname,
        "password_hash": hash_password(payload.password),
        "company_name": payload.company_name.strip(),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, uname)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, full_name=doc["full_name"], username=uname, company_name=doc["company_name"]),
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginIn):
    uname = payload.username.strip().lower()
    user = await db.users.find_one({"username": uname})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(user["id"], uname)
    return AuthResponse(
        token=token,
        user=UserOut(id=user["id"], full_name=user["full_name"], username=uname, company_name=user["company_name"]),
    )


@api_router.get("/auth/me", response_model=UserOut)
async def me(current=Depends(get_current_user)):
    return UserOut(
        id=current["id"],
        full_name=current["full_name"],
        username=current["username"],
        company_name=current["company_name"],
    )


# ----- Purchases -----
@api_router.get("/purchases")
async def list_purchases(current=Depends(get_current_user)):
    user_id = current["id"]
    purchases = await db.purchases.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # attach containers + counts
    for p in purchases:
        containers = await db.containers.find({"purchase_id": p["id"]}, {"_id": 0}).sort("sr_no", 1).to_list(1000)
        # compute live status from logs
        completed = 0
        for c in containers:
            c["status"] = await container_status_for(c["id"])
            log_count = await db.log_measurements.count_documents({"container_id": c["id"]})
            c["log_count"] = log_count
            if c["status"] == "completed":
                completed += 1
        p["containers"] = containers
        p["total_containers"] = len(containers)
        p["completed_containers"] = completed
        if len(containers) == 0:
            p["status"] = "pending"
        elif completed == len(containers):
            p["status"] = "completed"
        elif completed > 0 or any(c["status"] != "pending" for c in containers):
            p["status"] = "in_progress"
        else:
            p["status"] = "pending"
    return purchases


@api_router.post("/purchases")
async def create_purchase(payload: PurchaseIn, current=Depends(get_current_user)):
    user_id = current["id"]
    if not payload.containers:
        raise HTTPException(status_code=400, detail="At least one container required")
    # uniqueness within user
    existing = await db.purchases.find_one({"user_id": user_id, "bl_number": payload.bl_number})
    if existing:
        raise HTTPException(status_code=400, detail="BL number already exists")
    purchase_id = str(uuid.uuid4())
    pdoc = {
        "id": purchase_id,
        "user_id": user_id,
        "bl_number": payload.bl_number.strip(),
        "bl_date": payload.bl_date,
        "supplier_name": payload.supplier_name.strip(),
        "country": payload.country.strip(),
        "remarks": (payload.remarks or "").strip(),
        "created_at": now_iso(),
    }
    await db.purchases.insert_one(pdoc)
    for idx, c in enumerate(payload.containers, start=1):
        # Calculate avg girth if we have the data
        avg_girth_gross = None
        avg_girth_net = None
        if c.cbm_gross and c.pcs_supplier:
            avg_girth_gross = calc_avg_girth(c.cbm_gross, c.pcs_supplier)
        if c.cbm_net and c.pcs_supplier:
            avg_girth_net = calc_avg_girth(c.cbm_net, c.pcs_supplier)
        
        cdoc = {
            "id": str(uuid.uuid4()),
            "purchase_id": purchase_id,
            "user_id": user_id,
            "sr_no": idx,
            "container_number": c.container_number.strip(),
            "cbm_gross": c.cbm_gross,
            "cbm_net": c.cbm_net,
            "pcs_supplier": c.pcs_supplier,
            "avg_girth_gross": avg_girth_gross,
            "avg_girth_net": avg_girth_net,
            "l_avg": c.l_avg,
            "quality_supplier": c.quality_supplier,
            "bend_percent": None,
            "quality_by_us": None,
            "measurement_date": None,
            "completed_at": None,
            "is_loading_complete": False,
            "loading_complete_at": None,
            "created_at": now_iso(),
        }
        await db.containers.insert_one(cdoc)
    return {"id": purchase_id}


@api_router.get("/purchases/{purchase_id}")
async def get_purchase(purchase_id: str, current=Depends(get_current_user)):
    p = await db.purchases.find_one({"id": purchase_id, "user_id": current["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    containers = await db.containers.find({"purchase_id": purchase_id}, {"_id": 0}).sort("sr_no", 1).to_list(1000)
    for c in containers:
        c["status"] = await container_status_for(c["id"])
        c["log_count"] = await db.log_measurements.count_documents({"container_id": c["id"]})
    p["containers"] = containers
    return p


@api_router.patch("/purchases/{purchase_id}")
async def update_purchase(purchase_id: str, payload: PurchaseUpdateIn, current=Depends(get_current_user)):
    user_id = current["id"]
    p = await db.purchases.find_one({"id": purchase_id, "user_id": user_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    update = {}
    for f in ["bl_number", "bl_date", "supplier_name", "country", "remarks"]:
        v = getattr(payload, f)
        if v is not None:
            update[f] = v.strip() if isinstance(v, str) else v
    if update:
        if "bl_number" in update and update["bl_number"] != p["bl_number"]:
            dup = await db.purchases.find_one({"user_id": user_id, "bl_number": update["bl_number"]})
            if dup:
                raise HTTPException(status_code=400, detail="BL number already exists")
        await db.purchases.update_one({"id": purchase_id}, {"$set": update})
    # add new containers if provided
    if payload.new_containers:
        max_sr = await db.containers.find({"purchase_id": purchase_id}).sort("sr_no", -1).to_list(1)
        next_sr = (max_sr[0]["sr_no"] + 1) if max_sr else 1
        for c in payload.new_containers:
            # Calculate avg girth if we have the data
            avg_girth_gross = None
            avg_girth_net = None
            if c.cbm_gross and c.pcs_supplier:
                avg_girth_gross = calc_avg_girth(c.cbm_gross, c.pcs_supplier)
            if c.cbm_net and c.pcs_supplier:
                avg_girth_net = calc_avg_girth(c.cbm_net, c.pcs_supplier)
            
            await db.containers.insert_one({
                "id": str(uuid.uuid4()),
                "purchase_id": purchase_id,
                "user_id": user_id,
                "sr_no": next_sr,
                "container_number": c.container_number.strip(),
                "cbm_gross": c.cbm_gross,
                "cbm_net": c.cbm_net,
                "pcs_supplier": c.pcs_supplier,
                "avg_girth_gross": avg_girth_gross,
                "avg_girth_net": avg_girth_net,
                "l_avg": c.l_avg,
                "quality_supplier": c.quality_supplier,
                "bend_percent": None,
                "quality_by_us": None,
                "measurement_date": None,
                "completed_at": None,
                "is_loading_complete": False,
                "loading_complete_at": None,
                "created_at": now_iso(),
            })
            next_sr += 1
    return {"ok": True}


@api_router.delete("/purchases/{purchase_id}")
async def delete_purchase(purchase_id: str, current=Depends(get_current_user)):
    user_id = current["id"]
    p = await db.purchases.find_one({"id": purchase_id, "user_id": user_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    # delete logs, containers, purchase
    container_ids = [c["id"] async for c in db.containers.find({"purchase_id": purchase_id}, {"id": 1})]
    if container_ids:
        await db.log_measurements.delete_many({"container_id": {"$in": container_ids}})
        await db.containers.delete_many({"purchase_id": purchase_id})
    await db.purchases.delete_one({"id": purchase_id})
    return {"ok": True}


@api_router.delete("/containers/{container_id}")
async def delete_container(container_id: str, current=Depends(get_current_user)):
    c = await db.containers.find_one({"id": container_id, "user_id": current["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    log_count = await db.log_measurements.count_documents({"container_id": container_id})
    if log_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete container with measurements")
    await db.containers.delete_one({"id": container_id})
    return {"ok": True}


# ----- Container measurements -----
@api_router.get("/containers/{container_id}")
async def get_container(container_id: str, current=Depends(get_current_user)):
    c = await db.containers.find_one({"id": container_id, "user_id": current["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    p = await db.purchases.find_one({"id": c["purchase_id"]}, {"_id": 0})
    logs = await db.log_measurements.find({"container_id": container_id}, {"_id": 0}).sort("log_number", 1).to_list(10000)
    c["status"] = await container_status_for(container_id)
    c["purchase"] = p
    c["measurements"] = logs
    return c


@api_router.post("/containers/{container_id}/measurements")
async def save_measurements(container_id: str, payload: MeasurementsBulkIn, current=Depends(get_current_user)):
    user_id = current["id"]
    c = await db.containers.find_one({"id": container_id, "user_id": user_id})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    # find current max log_number
    max_log = await db.log_measurements.find({"container_id": container_id}).sort("log_number", -1).to_list(1)
    next_num = (max_log[0]["log_number"] + 1) if max_log else 1
    inserts = []
    for m in payload.measurements:
        calc = calc_log(m.le1, m.l, m.g1, m.g2)
        inserts.append({
            "id": str(uuid.uuid4()),
            "container_id": container_id,
            "user_id": user_id,
            "log_number": next_num,
            "le1": m.le1,
            "l": m.l,
            "g1": m.g1,
            "g2": m.g2,
            **calc,
            "created_at": now_iso(),
        })
        next_num += 1
    if inserts:
        await db.log_measurements.insert_many(inserts)
    if payload.mark_complete:
        await db.containers.update_one({"id": container_id}, {"$set": {"is_loading_complete": True}})
    return {"ok": True, "saved": len(inserts)}


@api_router.delete("/containers/{container_id}/measurements")
async def clear_measurements(container_id: str, current=Depends(get_current_user)):
    c = await db.containers.find_one({"id": container_id, "user_id": current["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    await db.log_measurements.delete_many({"container_id": container_id})
    await db.containers.update_one({"id": container_id}, {"$set": {"is_loading_complete": False}})
    return {"ok": True}


@api_router.patch("/containers/{container_id}/complete")
async def set_container_complete(container_id: str, payload: CompleteIn, current=Depends(get_current_user)):
    c = await db.containers.find_one({"id": container_id, "user_id": current["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    update_data = {"is_loading_complete": payload.is_complete}
    if payload.is_complete:
        update_data["loading_complete_at"] = now_iso()
    await db.containers.update_one({"id": container_id}, {"$set": update_data})
    return {"ok": True}


@api_router.patch("/containers/{container_id}/completion-form")
async def set_container_completion_form(container_id: str, payload: CompletionFormIn, current=Depends(get_current_user)):
    c = await db.containers.find_one({"id": container_id, "user_id": current["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    update_data = {}
    if payload.bend_percent is not None:
        update_data["bend_percent"] = payload.bend_percent
    if payload.quality_by_us is not None:
        update_data["quality_by_us"] = payload.quality_by_us.strip()
    if payload.measurement_date is not None:
        update_data["measurement_date"] = payload.measurement_date
    if update_data:
        update_data["completed_at"] = now_iso()
        update_data["is_loading_complete"] = True
        update_data["loading_complete_at"] = now_iso()
        await db.containers.update_one({"id": container_id}, {"$set": update_data})
    return {"ok": True}


# ----- Suppliers -----
@api_router.get("/suppliers")
async def list_suppliers(current=Depends(get_current_user)):
    user_id = current["id"]
    suppliers = await db.suppliers.find({"user_id": user_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    return suppliers


@api_router.post("/suppliers")
async def create_supplier(payload: SupplierIn, current=Depends(get_current_user)):
    user_id = current["id"]
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name required")
    # Check if already exists
    existing = await db.suppliers.find_one({"user_id": user_id, "name": name})
    if existing:
        return existing  # Return existing instead of error
    supplier_id = str(uuid.uuid4())
    doc = {
        "id": supplier_id,
        "user_id": user_id,
        "name": name,
        "created_at": now_iso(),
    }
    await db.suppliers.insert_one(doc)
    return {"id": supplier_id, "user_id": user_id, "name": name, "created_at": doc["created_at"]}


# ----- Countries -----
@api_router.get("/countries")
async def list_countries(current=Depends(get_current_user)):
    user_id = current["id"]
    countries = await db.countries.find({"user_id": user_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    return countries


@api_router.post("/countries")
async def create_country(payload: CountryIn, current=Depends(get_current_user)):
    user_id = current["id"]
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Country name required")
    # Check if already exists
    existing = await db.countries.find_one({"user_id": user_id, "name": name})
    if existing:
        return existing  # Return existing instead of error
    country_id = str(uuid.uuid4())
    doc = {
        "id": country_id,
        "user_id": user_id,
        "name": name,
        "created_at": now_iso(),
    }
    await db.countries.insert_one(doc)
    return {"id": country_id, "user_id": user_id, "name": name, "created_at": doc["created_at"]}


@api_router.post("/countries/seed")
async def seed_countries(current=Depends(get_current_user)):
    """Seed common timber countries for the current user"""
    user_id = current["id"]
    common_countries = [
        "Ecuador", "Brazil", "Indonesia", "Malaysia", "Myanmar",
        "Cameroon", "Gabon", "Congo", "Ghana", "Ivory Coast",
        "Solomon Islands", "Papua New Guinea", "Laos", "Vietnam"
    ]
    added = []
    for country_name in common_countries:
        existing = await db.countries.find_one({"user_id": user_id, "name": country_name})
        if not existing:
            doc = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "name": country_name,
                "created_at": now_iso(),
            }
            await db.countries.insert_one(doc)
            added.append(country_name)
    return {"added": added, "total": len(common_countries)}


# ----- Dashboard -----
@api_router.get("/dashboard/kpis")
async def dashboard_kpis(current=Depends(get_current_user)):
    """Enhanced KPI dashboard with detailed statistics"""
    user_id = current["id"]
    
    # Get all purchases
    all_purchases = await db.purchases.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    
    total_bls = len(all_purchases)
    total_containers = 0
    total_pieces = 0
    total_cbm1 = 0.0
    total_cft1 = 0.0
    total_cbm2 = 0.0
    total_cft2 = 0.0
    
    bls_not_started = 0
    bls_in_progress = 0
    bls_completed = 0
    
    containers_pending = 0
    containers_in_progress = 0
    containers_completed = 0
    
    pending_container_list = []
    pending_bl_list = []
    recent_activity = []
    
    for p in all_purchases:
        containers = await db.containers.find({"purchase_id": p["id"]}, {"_id": 0}).sort("sr_no", 1).to_list(1000)
        total_containers += len(containers)
        
        bl_has_any_measurement = False
        bl_all_complete = True if containers else False
        
        for c in containers:
            logs = await db.log_measurements.find({"container_id": c["id"]}, {"_id": 0}).sort("log_number", 1).to_list(10000)
            log_count = len(logs)
            
            status = await container_status_for(c["id"])
            
            if status == "completed":
                containers_completed += 1
                # Add to recent activity
                if c.get("measurement_date"):
                    recent_activity.append({
                        "container_number": c["container_number"],
                        "bl_number": p["bl_number"],
                        "pieces": log_count,
                        "measurement_date": c["measurement_date"],
                        "cbm2": sum(lg["cbm2"] for lg in logs),
                    })
            elif status == "in_progress":
                containers_in_progress += 1
                bl_all_complete = False
            else:  # pending
                containers_pending += 1
                bl_all_complete = False
                pending_container_list.append({
                    "container_id": c["id"],
                    "container_number": c["container_number"],
                    "bl_number": p["bl_number"],
                    "bl_date": p["bl_date"],
                    "supplier_name": p["supplier_name"],
                    "country": p["country"],
                    "pcs_supplier": c.get("pcs_supplier"),
                    "cbm_gross": c.get("cbm_gross"),
                })
            
            if log_count > 0:
                bl_has_any_measurement = True
                total_pieces += log_count
                for lg in logs:
                    total_cbm1 += lg["cbm1"]
                    total_cft1 += lg["cft1"]
                    total_cbm2 += lg["cbm2"]
                    total_cft2 += lg["cft2"]
        
        # Classify BL status
        if not bl_has_any_measurement:
            bls_not_started += 1
            pending_bl_list.append({
                "purchase_id": p["id"],
                "bl_number": p["bl_number"],
                "bl_date": p["bl_date"],
                "supplier_name": p["supplier_name"],
                "country": p["country"],
                "total_containers": len(containers),
            })
        elif bl_all_complete:
            bls_completed += 1
        else:
            bls_in_progress += 1
    
    # Sort recent activity by date (most recent first)
    recent_activity.sort(key=lambda x: x["measurement_date"], reverse=True)
    recent_activity = recent_activity[:10]
    
    # Sort pending containers by BL date (oldest first)
    pending_container_list.sort(key=lambda x: x["bl_date"])
    
    # Sort pending BLs by date (oldest first)
    pending_bl_list.sort(key=lambda x: x["bl_date"])
    
    return {
        "overview": {
            "total_bls": total_bls,
            "active_bls": bls_in_progress,
            "completed_bls": bls_completed,
            "total_containers": total_containers,
        },
        "volume": {
            "total_pieces": total_pieces,
            "total_cbm1": round(total_cbm1, 4),
            "total_cft1": round(total_cft1, 4),
            "total_cbm2": round(total_cbm2, 4),
            "total_cft2": round(total_cft2, 4),
        },
        "alerts": {
            "bls_not_started": bls_not_started,
            "bls_in_progress": bls_in_progress,
            "containers_pending": containers_pending,
            "containers_completed": containers_completed,
        },
        "pending_containers": pending_container_list,
        "pending_bls": pending_bl_list,
        "recent_activity": recent_activity,
    }


@api_router.get("/dashboard/summary")
async def dashboard_summary(
    bl_search: Optional[str] = None,
    country: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current=Depends(get_current_user),
):
    user_id = current["id"]
    q: dict = {"user_id": user_id}
    if bl_search:
        q["bl_number"] = {"$regex": bl_search, "$options": "i"}
    if country:
        q["country"] = country
    if date_from or date_to:
        d = {}
        if date_from:
            d["$gte"] = date_from
        if date_to:
            d["$lte"] = date_to
        q["bl_date"] = d
    purchases = await db.purchases.find(q, {"_id": 0}).sort("bl_date", -1).to_list(2000)
    grand = {"pieces": 0, "cbm1": 0.0, "cft1": 0.0, "cbm2": 0.0, "cft2": 0.0, "containers": 0, "bls": len(purchases)}

    result = []
    countries_set = set()
    for p in purchases:
        countries_set.add(p["country"])
        containers = await db.containers.find({"purchase_id": p["id"]}, {"_id": 0}).sort("sr_no", 1).to_list(1000)
        bl_totals = {"pieces": 0, "cbm1": 0.0, "cft1": 0.0, "cbm2": 0.0, "cft2": 0.0}
        for c in containers:
            logs = await db.log_measurements.find({"container_id": c["id"]}, {"_id": 0}).sort("log_number", 1).to_list(10000)
            t = {"pieces": len(logs), "cbm1": 0.0, "cft1": 0.0, "cbm2": 0.0, "cft2": 0.0,
                 "sum_g1": 0.0, "sum_g2": 0.0, "sum_le1": 0.0, "sum_l": 0.0}
            for lg in logs:
                t["cbm1"] += lg["cbm1"]
                t["cft1"] += lg["cft1"]
                t["cbm2"] += lg["cbm2"]
                t["cft2"] += lg["cft2"]
                t["sum_g1"] += lg["g1"]
                t["sum_g2"] += lg["g2"]
                t["sum_le1"] += lg["le1"]
                t["sum_l"] += lg["l"]
            n = max(len(logs), 1)
            c["pieces"] = len(logs)
            c["totals"] = {
                "cbm1": round(t["cbm1"], 4), "cft1": round(t["cft1"], 4),
                "cbm2": round(t["cbm2"], 4), "cft2": round(t["cft2"], 4),
                "avg_cbm1": round(t["cbm1"] / n, 4), "avg_cbm2": round(t["cbm2"] / n, 4),
                "avg_g1": round(t["sum_g1"] / n, 2), "avg_g2": round(t["sum_g2"] / n, 2),
                "avg_le1": round(t["sum_le1"] / n, 2), "avg_l": round(t["sum_l"] / n, 2),
            }
            c["status"] = await container_status_for(c["id"])
            c["measurements"] = logs
            for k in ["pieces", "cbm1", "cft1", "cbm2", "cft2"]:
                bl_totals[k] += t[k] if k != "pieces" else len(logs)
        p["containers"] = containers
        p["totals"] = {k: round(v, 4) if isinstance(v, float) else v for k, v in bl_totals.items()}
        for k in ["pieces", "cbm1", "cft1", "cbm2", "cft2"]:
            grand[k] += bl_totals[k]
        grand["containers"] += len(containers)
        result.append(p)

    return {
        "purchases": result,
        "grand_totals": {k: round(v, 4) if isinstance(v, float) else v for k, v in grand.items()},
        "countries": sorted(countries_set),
    }


# ----- Mount + middleware -----
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("username", unique=True)
    await db.purchases.create_index([("user_id", 1), ("bl_number", 1)], unique=True)
    await db.containers.create_index("purchase_id")
    await db.log_measurements.create_index("container_id")
    await db.suppliers.create_index([("user_id", 1), ("name", 1)], unique=True)
    await db.countries.create_index([("user_id", 1), ("name", 1)], unique=True)
    
    # Seed common timber countries for all users (they can add more)
    # This creates a global list - users can add their own as well
    common_countries = [
        "Ecuador", "Brazil", "Indonesia", "Malaysia", "Myanmar",
        "Cameroon", "Gabon", "Congo", "Ghana", "Ivory Coast",
        "Solomon Islands", "Papua New Guinea", "Laos", "Vietnam"
    ]
    # We'll seed these for the system - when a user signs up, they can see these
    # For simplicity, we'll let users create their own lists
    logger.info("Database indexes created and ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
