from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.espaco import Espaco, EspacoUsuario, PapelUsuario
from app.models.usuario import Usuario
from app.schemas.espaco import EspacoCreate, EspacoResponse

from app.api.auth import get_current_user 

router = APIRouter(
    prefix="/espacos",
    tags=["Espaços"]
)

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
    db.commit()
    db.refresh(novo_espaco)

    relacao = EspacoUsuario(
        espaco_id=novo_espaco.id,
        usuario_id=usuario_atual.id,
        papel=PapelUsuario.ADMIN
    )
    db.add(relacao)
    db.commit()

    return novo_espaco