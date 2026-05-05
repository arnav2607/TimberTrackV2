from pydantic import BaseModel
from typing import Optional

class LogUpdateIn(BaseModel):
    le1: Optional[float] = None
    l: Optional[float] = None
    g1: Optional[float] = None
    g2: Optional[float] = None
