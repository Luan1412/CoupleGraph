from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

class MembroEspacoDetalhe(BaseModel):
    usuario_id: Optional[int] = None
    convite_id: Optional[int] = None
    nome: str
    email: str
    papel: str
    status: str = "ativo"

    model_config = ConfigDict(from_attributes=True)

class MembroPapelUpdate(BaseModel):
    papel: str

class EspacoBase(BaseModel):
    nome: str
    cor: Optional[str] = "#3B82F6"
    icone: Optional[str] = "casal"

class EspacoCreate(EspacoBase):
    pass

class EspacoUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None
    icone: Optional[str] = None

class EspacoResponse(EspacoBase):
    id: int
    criado_por: int
    created_at: datetime
    cor: Optional[str] = "#3B82F6"
    icone: Optional[str] = "casal"
    total_membros: int = 1
    saldo: float = 0.0
    despesas: float = 0.0
    membros_detalhes: List[MembroEspacoDetalhe] = []

    model_config = ConfigDict(from_attributes=True)

class EspacoUsuarioResponse(BaseModel):
    id: int
    espaco_id: int
    usuario_id: int
    papel: str
    created_at: datetime

    espaco: EspacoResponse

    model_config = ConfigDict(from_attributes=True)

class ConviteCreate(BaseModel):
    email: str

class ConviteResponse(BaseModel):
    id: int
    espaco_id: int
    espaco_nome: str
    email: str
    convidado_por: int
    convidado_por_nome: str
    convidado_por_email: Optional[str] = ""
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoriaOrcamentoItem(BaseModel):
    id: Optional[int] = None
    nome: str
    limite: float = 0.0
    cor: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrcamentoEspacoResponse(BaseModel):
    espaco_id: int
    teto_geral: Optional[float] = None
    categorias: List[CategoriaOrcamentoItem] = []
    pode_editar: bool = False

    model_config = ConfigDict(from_attributes=True)


class OrcamentoEspacoUpdate(BaseModel):
    teto_geral: Optional[float] = None
    categorias: List[CategoriaOrcamentoItem] = []