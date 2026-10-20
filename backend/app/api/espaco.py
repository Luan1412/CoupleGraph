from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.usuario import Usuario
from app.models.espaco import Espaco, EspacoUsuario, PapelUsuario
from app.schemas.espaco import EspacoCreate, EspacoUpdate, EspacoResponse, EspacoUsuarioResponse

router = APIRouter(prefix="/api/espacos", tags=["Espaços"])

@router.post("/", response_model=EspacoResponse, status_code=status.HTTP_201_CREATED)
def criar_espaco(
    espaco_in: EspacoCreate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    nome_normalizado = espaco_in.nome.strip()
    
    # Valida se a pessoa já é administradora de um espaço com este mesmo nome
    espaco_existente = (
        db.query(Espaco)
        .join(EspacoUsuario, EspacoUsuario.espaco_id == Espaco.id)
        .filter(
            EspacoUsuario.usuario_id == usuario_atual.id,
            EspacoUsuario.papel == PapelUsuario.ADMIN,
            func.lower(Espaco.nome) == func.lower(nome_normalizado)
        )
        .first()
    )
    if espaco_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você já é dono(a) de um espaço com este nome."
        )

    novo_espaco = Espaco(
        nome=nome_normalizado,
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

@router.put("/{espaco_id}", response_model=EspacoResponse)
def atualizar_espaco(
    espaco_id: int,
    espaco_in: EspacoUpdate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id,
        EspacoUsuario.papel == PapelUsuario.ADMIN
    ).first()
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Permissão negada para alterar este espaço."
        )

    espaco = db.query(Espaco).filter(Espaco.id == espaco_id).first()
    if not espaco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Espaço não encontrado."
        )

    nome_normalizado = espaco_in.nome.strip()
    
    # Valida se já existe outro espaço com este mesmo nome administrado pelo usuário
    outro_espaco = (
        db.query(Espaco)
        .join(EspacoUsuario, EspacoUsuario.espaco_id == Espaco.id)
        .filter(
            EspacoUsuario.usuario_id == usuario_atual.id,
            EspacoUsuario.papel == PapelUsuario.ADMIN,
            Espaco.id != espaco_id,
            func.lower(Espaco.nome) == func.lower(nome_normalizado)
        )
        .first()
    )
    if outro_espaco:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você já é dono(a) de um espaço com este nome."
        )

    espaco.nome = nome_normalizado
    db.commit()
    db.refresh(espaco)
    return espaco

@router.delete("/{espaco_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_espaco(
    espaco_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id,
        EspacoUsuario.papel == PapelUsuario.ADMIN
    ).first()
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Permissão negada para excluir este espaço."
        )

    espaco = db.query(Espaco).filter(Espaco.id == espaco_id).first()
    if not espaco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Espaço não encontrado."
        )

    db.query(EspacoUsuario).filter(EspacoUsuario.espaco_id == espaco_id).delete()
    db.delete(espaco)
    db.commit()
    return None