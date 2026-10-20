from pydantic import BaseModel, ConfigDict
from datetime import datetime

class EspacoBase(BaseModel):
    nome: str

class EspacoCreate(EspacoBase):
    pass 

class EspacoUpdate(EspacoBase):
    pass 

class EspacoResponse(EspacoBase):
    id: int
    criado_por: int
    created_at: datetime
    total_membros: int = 1
    saldo: float = 0.0
    despesas: float = 0.0

    model_config = ConfigDict(from_attributes=True) 

class EspacoUsuarioResponse(BaseModel):
    id: int
    espaco_id: int
    usuario_id: int
    papel: str
    created_at: datetime
    
    espaco: EspacoResponse 

    model_config = ConfigDict(from_attributes=True)