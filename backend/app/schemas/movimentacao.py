from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional
from app.models.espaco import TipoMovimentacao

class MovimentacaoBase(BaseModel):
    espaco_id: int
    tipo: TipoMovimentacao
    descricao: Optional[str] = None
    valor: float = Field(gt=0, description="O valor deve ser positivo")
    categoria: str
    data: Optional[datetime] = None

class MovimentacaoCreate(MovimentacaoBase):
    pass

class MovimentacaoUpdate(BaseModel):
    espaco_id: Optional[int] = None
    tipo: Optional[TipoMovimentacao] = None
    descricao: Optional[str] = None
    valor: Optional[float] = None
    categoria: Optional[str] = None
    data: Optional[datetime] = None

class MovimentacaoResponse(BaseModel):
    id: int
    espaco_id: int
    usuario_id: int
    tipo: TipoMovimentacao
    descricao: Optional[str] = None
    valor: float
    categoria: str
    data: datetime
    created_at: datetime
    
    usuario_nome: Optional[str] = None
    espaco_nome: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class MovimentacaoResumo(BaseModel):
    total_receitas: float = 0.0
    total_despesas: float = 0.0
    saldo: float = 0.0
    total_movimentacoes: int = 0
