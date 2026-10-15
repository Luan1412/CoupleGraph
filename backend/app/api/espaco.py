from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.usuario import Usuario
from app.models.espaco import Espaco, EspacoUsuario, PapelUsuario
from app.schemas.espaco import EspacoCreate, EspacoResponse, EspacoUsuarioResponse

router = APIRouter(prefix="/api/espacos", tags=["Espaços"])

@router.post("/", response_model=EspacoResponse, status_code=status.HTTP_201_CREATED)
def criar_espaco(
    espaco_in: EspacoCreate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    novo_espaco = Espaco(
        nome=espaco_in.nome,
        criado_por=usuario_atual.id
    )
    db.add(novo_espaco)
    db.flush()

    vinculo_admin = EspacoUsuario(
        espaco_id=novo_espaco.id,
        usuario_id=usuario_atual.id,
        papel=PapelUsuario.ADMIN
    )
    db.add(vinculo_admin)
    db.commit()
    db.refresh(novo_espaco)
    
    return novo_espaco

@router.get("/meus", response_model=List[EspacoUsuarioResponse])
def listar_meus_espacos(
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    """
    Retorna todos os espaços aos quais o utilizador autenticado está vinculado
    através da tabela pivô (seja como administrador ou participante).
    """
    return db.query(EspacoUsuario).filter(
        EspacoUsuario.usuario_id == usuario_atual.id
    ).all()