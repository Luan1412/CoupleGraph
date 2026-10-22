from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, or_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.usuario import Usuario
from app.models.espaco import Espaco, EspacoUsuario, Movimentacao, TipoMovimentacao
from app.schemas.movimentacao import (
    MovimentacaoCreate,
    MovimentacaoUpdate,
    MovimentacaoResponse,
    MovimentacaoResumo
)

router = APIRouter(prefix="/api/movimentacoes", tags=["Movimentações"])


def _verificar_acesso_espaco(db: Session, espaco_id: int, usuario_id: int) -> Espaco:
    espaco_usuario = (
        db.query(EspacoUsuario)
        .filter(EspacoUsuario.espaco_id == espaco_id, EspacoUsuario.usuario_id == usuario_id)
        .first()
    )
    if not espaco_usuario:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não possui acesso a este espaço."
        )
    return espaco_usuario.espaco


@router.post("/", response_model=MovimentacaoResponse, status_code=status.HTTP_201_CREATED)
def criar_movimentacao(
    mov_in: MovimentacaoCreate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    espaco = _verificar_acesso_espaco(db, mov_in.espaco_id, usuario_atual.id)

    data_mov = mov_in.data if mov_in.data else datetime.utcnow()

    nova_mov = Movimentacao(
        espaco_id=espaco.id,
        usuario_id=usuario_atual.id,
        tipo=mov_in.tipo,
        descricao=mov_in.descricao.strip() if mov_in.descricao else "Sem descrição",
        valor=mov_in.valor,
        categoria=mov_in.categoria.strip() if mov_in.categoria else "Outros",
        data=data_mov
    )
    db.add(nova_mov)
    db.commit()
    db.refresh(nova_mov)

    return MovimentacaoResponse(
        id=nova_mov.id,
        espaco_id=nova_mov.espaco_id,
        usuario_id=nova_mov.usuario_id,
        tipo=nova_mov.tipo,
        descricao=nova_mov.descricao,
        valor=float(nova_mov.valor),
        categoria=nova_mov.categoria,
        data=nova_mov.data,
        created_at=nova_mov.created_at or datetime.utcnow(),
        usuario_nome=usuario_atual.nome,
        espaco_nome=espaco.nome
    )


@router.get("/", response_model=List[MovimentacaoResponse])
def listar_movimentacoes(
    espaco_id: Optional[int] = Query(None, description="Filtrar por espaço"),
    tipo: Optional[TipoMovimentacao] = Query(None, description="Filtrar por tipo (receita ou despesa)"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoria"),
    busca: Optional[str] = Query(None, description="Buscar texto na descrição"),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Mês da movimentação"),
    ano: Optional[int] = Query(None, ge=2000, le=2100, description="Ano da movimentação"),
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    # Identifica os espaços do usuário logado
    meus_espacos_ids = [
        item.espaco_id
        for item in db.query(EspacoUsuario.espaco_id)
        .filter(EspacoUsuario.usuario_id == usuario_atual.id)
        .all()
    ]

    if not meus_espacos_ids:
        return []

    query = db.query(Movimentacao).filter(Movimentacao.espaco_id.in_(meus_espacos_ids))

    if espaco_id:
        if espaco_id not in meus_espacos_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem acesso a este espaço."
            )
        query = query.filter(Movimentacao.espaco_id == espaco_id)

    if tipo:
        query = query.filter(Movimentacao.tipo == tipo)

    if categoria and categoria != 'todas':
        query = query.filter(func.lower(Movimentacao.categoria) == func.lower(categoria))

    if busca and busca.strip():
        termo = f"%{busca.strip()}%"
        query = query.filter(
            or_(
                Movimentacao.descricao.ilike(termo),
                Movimentacao.categoria.ilike(termo)
            )
        )

    if ano:
        query = query.filter(extract('year', Movimentacao.data) == ano)

    if mes:
        query = query.filter(extract('month', Movimentacao.data) == mes)

    if data_inicio and data_inicio.strip():
        try:
            dt_inicio = datetime.strptime(data_inicio.strip(), "%Y-%m-%d")
            query = query.filter(Movimentacao.data >= dt_inicio)
        except ValueError:
            pass

    if data_fim and data_fim.strip():
        try:
            dt_fim = datetime.strptime(data_fim.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(Movimentacao.data <= dt_fim)
        except ValueError:
            pass

    movs = query.order_by(Movimentacao.data.desc(), Movimentacao.id.desc()).all()

    resposta = []
    for m in movs:
        resposta.append(
            MovimentacaoResponse(
                id=m.id,
                espaco_id=m.espaco_id,
                usuario_id=m.usuario_id,
                tipo=m.tipo,
                descricao=m.descricao,
                valor=float(m.valor),
                categoria=m.categoria,
                data=m.data,
                created_at=m.created_at or datetime.utcnow(),
                usuario_nome=m.usuario.nome if m.usuario else "Usuário",
                espaco_nome=m.espaco.nome if m.espaco else "Espaço"
            )
        )

    return resposta


@router.get("/resumo", response_model=MovimentacaoResumo)
def obter_resumo(
    espaco_id: Optional[int] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None, ge=2000, le=2100),
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    meus_espacos_ids = [
        item.espaco_id
        for item in db.query(EspacoUsuario.espaco_id)
        .filter(EspacoUsuario.usuario_id == usuario_atual.id)
        .all()
    ]

    if not meus_espacos_ids:
        return MovimentacaoResumo()

    query = db.query(Movimentacao).filter(Movimentacao.espaco_id.in_(meus_espacos_ids))

    if espaco_id:
        if espaco_id not in meus_espacos_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem acesso a este espaço."
            )
        query = query.filter(Movimentacao.espaco_id == espaco_id)

    if ano:
        query = query.filter(extract('year', Movimentacao.data) == ano)

    if mes:
        query = query.filter(extract('month', Movimentacao.data) == mes)

    if data_inicio and data_inicio.strip():
        try:
            dt_inicio = datetime.strptime(data_inicio.strip(), "%Y-%m-%d")
            query = query.filter(Movimentacao.data >= dt_inicio)
        except ValueError:
            pass

    if data_fim and data_fim.strip():
        try:
            dt_fim = datetime.strptime(data_fim.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(Movimentacao.data <= dt_fim)
        except ValueError:
            pass

    movs = query.all()

    rec = sum(float(m.valor) for m in movs if m.tipo == TipoMovimentacao.RECEITA)
    desp = sum(float(m.valor) for m in movs if m.tipo == TipoMovimentacao.DESPESA)

    return MovimentacaoResumo(
        total_receitas=rec,
        total_despesas=desp,
        saldo=rec - desp,
        total_movimentacoes=len(movs)
    )


@router.put("/{mov_id}", response_model=MovimentacaoResponse)
def atualizar_movimentacao(
    mov_id: int,
    mov_in: MovimentacaoUpdate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    mov = db.query(Movimentacao).filter(Movimentacao.id == mov_id).first()
    if not mov:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimentação não encontrada."
        )

    vinculo = (
        db.query(EspacoUsuario)
        .filter(
            EspacoUsuario.espaco_id == mov.espaco_id,
            EspacoUsuario.usuario_id == usuario_atual.id
        )
        .first()
    )
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para editar esta movimentação."
        )

    if mov_in.espaco_id is not None:
        _verificar_acesso_espaco(db, mov_in.espaco_id, usuario_atual.id)
        mov.espaco_id = mov_in.espaco_id

    if mov_in.tipo is not None:
        mov.tipo = mov_in.tipo

    if mov_in.descricao is not None:
        mov.descricao = mov_in.descricao.strip()

    if mov_in.valor is not None:
        if mov_in.valor <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O valor deve ser maior que zero."
            )
        mov.valor = mov_in.valor

    if mov_in.categoria is not None:
        mov.categoria = mov_in.categoria.strip()

    if mov_in.data is not None:
        mov.data = mov_in.data

    db.commit()
    db.refresh(mov)

    return MovimentacaoResponse(
        id=mov.id,
        espaco_id=mov.espaco_id,
        usuario_id=mov.usuario_id,
        tipo=mov.tipo,
        descricao=mov.descricao,
        valor=float(mov.valor),
        categoria=mov.categoria,
        data=mov.data,
        created_at=mov.created_at or datetime.utcnow(),
        usuario_nome=mov.usuario.nome if mov.usuario else usuario_atual.nome,
        espaco_nome=mov.espaco.nome if mov.espaco else "Espaço"
    )


@router.delete("/{mov_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_movimentacao(
    mov_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    mov = db.query(Movimentacao).filter(Movimentacao.id == mov_id).first()
    if not mov:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimentação não encontrada."
        )

    # Verifica se o usuário pertence ao espaço da movimentação
    vinculo = (
        db.query(EspacoUsuario)
        .filter(
            EspacoUsuario.espaco_id == mov.espaco_id,
            EspacoUsuario.usuario_id == usuario_atual.id
        )
        .first()
    )
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para remover esta movimentação."
        )

    db.delete(mov)
    db.commit()
    return None
