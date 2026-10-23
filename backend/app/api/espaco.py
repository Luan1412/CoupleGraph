from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.usuario import Usuario
from app.models.espaco import (
    Espaco,
    EspacoUsuario,
    PapelUsuario,
    Convite,
    StatusConvite,
    OrcamentoEspacoConfig,
    CategoriaEspaco
)
from app.schemas.espaco import (
    EspacoCreate,
    EspacoUpdate,
    EspacoResponse,
    EspacoUsuarioResponse,
    ConviteCreate,
    ConviteResponse,
    MembroPapelUpdate,
    OrcamentoEspacoResponse,
    OrcamentoEspacoUpdate,
    CategoriaOrcamentoItem
)

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
        cor=espaco_in.cor or "#3B82F6",
        icone=espaco_in.icone or "casal",
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


# =========================================================
# ROTAS DE CONVITES PARA PARTICIPAR DE ESPAÇOS
# =========================================================

@router.get("/convites/recebidos", response_model=List[ConviteResponse])
def listar_convites_recebidos(
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    """
    Lista todos os convites pendentes enviados para o e-mail do usuário logado.
    """
    return (
        db.query(Convite)
        .filter(
            func.lower(Convite.email) == func.lower(usuario_atual.email.strip()),
            Convite.status == StatusConvite.PENDENTE
        )
        .order_by(Convite.created_at.desc())
        .all()
    )


@router.get("/convites/enviados", response_model=List[ConviteResponse])
def listar_convites_enviados(
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    """
    Lista todos os convites enviados pelo usuário logado.
    """
    return (
        db.query(Convite)
        .filter(Convite.convidado_por == usuario_atual.id)
        .order_by(Convite.created_at.desc())
        .all()
    )


@router.post("/{espaco_id}/convites", response_model=ConviteResponse, status_code=status.HTTP_201_CREATED)
def enviar_convite_espaco(
    espaco_id: int,
    convite_in: ConviteCreate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id
    ).first()
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para convidar pessoas para este espaço."
        )

    espaco = db.query(Espaco).filter(Espaco.id == espaco_id).first()
    if not espaco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Espaço não encontrado."
        )

    email_destino = convite_in.email.strip().lower()
    if not email_destino or "@" not in email_destino:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe um e-mail válido para enviar o convite."
        )

    if email_destino == usuario_atual.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você já faz parte deste espaço."
        )

    # Verifica se o usuário convidado já é membro do espaço
    usuario_convidado = db.query(Usuario).filter(func.lower(Usuario.email) == email_destino).first()
    if usuario_convidado:
        ja_membro = db.query(EspacoUsuario).filter(
            EspacoUsuario.espaco_id == espaco_id,
            EspacoUsuario.usuario_id == usuario_convidado.id
        ).first()
        if ja_membro:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este usuário já participa deste espaço."
            )

    # Verifica se já existe convite para este e-mail neste espaço
    convite_existente = (
        db.query(Convite)
        .filter(
            Convite.espaco_id == espaco_id,
            func.lower(Convite.email) == email_destino
        )
        .order_by(Convite.id.desc())
        .first()
    )
    if convite_existente:
        if convite_existente.status == StatusConvite.PENDENTE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um convite pendente para este e-mail neste espaço."
            )
        elif convite_existente.status == StatusConvite.ACEITO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este usuário já faz parte deste espaço."
            )
        else: # RECUSADO
            convite_existente.status = StatusConvite.PENDENTE
            convite_existente.convidado_por = usuario_atual.id
            convite_existente.created_at = func.now()
            db.commit()
            db.refresh(convite_existente)
            return convite_existente

    novo_convite = Convite(
        espaco_id=espaco_id,
        email=email_destino,
        convidado_por=usuario_atual.id,
        status=StatusConvite.PENDENTE
    )
    db.add(novo_convite)
    db.commit()
    db.refresh(novo_convite)
    return novo_convite


@router.post("/convites/{convite_id}/aceitar", response_model=ConviteResponse)
def aceitar_convite(
    convite_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    convite = db.query(Convite).filter(Convite.id == convite_id).first()
    if not convite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite não encontrado."
        )

    if convite.email.strip().lower() != usuario_atual.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este convite não pertence ao seu usuário."
        )

    if convite.status != StatusConvite.PENDENTE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este convite já foi respondido."
        )

    # Verifica se já existe vínculo no espaço
    vinculo_existente = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == convite.espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id
    ).first()

    if not vinculo_existente:
        novo_vinculo = EspacoUsuario(
            espaco_id=convite.espaco_id,
            usuario_id=usuario_atual.id,
            papel=PapelUsuario.MEMBRO
        )
        db.add(novo_vinculo)

    convite.status = StatusConvite.ACEITO

    # Atualiza qualquer outro convite pendente para este email no mesmo espaço
    db.query(Convite).filter(
        Convite.espaco_id == convite.espaco_id,
        func.lower(Convite.email) == usuario_atual.email.strip().lower(),
        Convite.status == StatusConvite.PENDENTE
    ).update({"status": StatusConvite.ACEITO})

    db.commit()
    db.refresh(convite)
    return convite


@router.post("/convites/{convite_id}/recusar", response_model=ConviteResponse)
def recusar_convite(
    convite_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    convite = db.query(Convite).filter(Convite.id == convite_id).first()
    if not convite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite não encontrado."
        )

    eh_destinatario = convite.email.strip().lower() == usuario_atual.email.strip().lower()
    eh_remetente = convite.convidado_por == usuario_atual.id

    if not eh_destinatario and not eh_remetente:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para recusar ou cancelar este convite."
        )

    convite.status = StatusConvite.RECUSADO
    db.commit()
    db.refresh(convite)
    return convite


@router.delete("/convites/{convite_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_convite(
    convite_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    convite = db.query(Convite).filter(Convite.id == convite_id).first()
    if not convite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite não encontrado."
        )

    eh_remetente = convite.convidado_por == usuario_atual.id
    eh_destinatario = convite.email.strip().lower() == usuario_atual.email.strip().lower()
    eh_admin = False
    if not eh_remetente and not eh_destinatario:
        admin_vinc = db.query(EspacoUsuario).filter(
            EspacoUsuario.espaco_id == convite.espaco_id,
            EspacoUsuario.usuario_id == usuario_atual.id,
            EspacoUsuario.papel == PapelUsuario.ADMIN
        ).first()
        eh_admin = admin_vinc is not None

    if not eh_remetente and not eh_destinatario and not eh_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para remover este convite."
        )

    db.delete(convite)
    db.commit()
    return None


@router.delete("/{espaco_id}/membros/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_membro_espaco(
    espaco_id: int,
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    # Verifica permissão do usuário solicitante
    admin_vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id,
        EspacoUsuario.papel == PapelUsuario.ADMIN
    ).first()
    if not admin_vinculo and usuario_atual.id != usuario_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o administrador pode remover participantes deste espaço."
        )

    if usuario_atual.id == usuario_id and admin_vinculo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O administrador não pode se remover do espaço."
        )

    membro_vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_id
    ).first()
    if not membro_vinculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participante não encontrado neste espaço."
        )

    db.delete(membro_vinculo)
    db.commit()
    return None


@router.post("/{espaco_id}/sair", status_code=status.HTTP_204_NO_CONTENT)
def sair_do_espaco(
    espaco_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id
    ).first()
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Você não participa deste espaço."
        )

    # Se for admin, valida se há outro admin
    if vinculo.papel == PapelUsuario.ADMIN:
        outros_admins = db.query(EspacoUsuario).filter(
            EspacoUsuario.espaco_id == espaco_id,
            EspacoUsuario.usuario_id != usuario_atual.id,
            EspacoUsuario.papel == PapelUsuario.ADMIN
        ).count()
        total_membros = db.query(EspacoUsuario).filter(EspacoUsuario.espaco_id == espaco_id).count()

        if outros_admins == 0 and total_membros > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você é o único administrador deste espaço. Promova outro participante a administrador antes de sair."
            )
        elif outros_admins == 0 and total_membros <= 1:
            # É o único membro, apaga o espaço
            db.query(Convite).filter(Convite.espaco_id == espaco_id).delete()
            db.query(EspacoUsuario).filter(EspacoUsuario.espaco_id == espaco_id).delete()
            db.query(Espaco).filter(Espaco.id == espaco_id).delete()
            db.commit()
            return None

    db.delete(vinculo)
    db.commit()
    return None


@router.put("/{espaco_id}/membros/{usuario_id}/papel", response_model=EspacoResponse)
def alterar_papel_membro(
    espaco_id: int,
    usuario_id: int,
    papel_in: MembroPapelUpdate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    # Verifica se usuario_atual é admin do espaço
    admin_vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id,
        EspacoUsuario.papel == PapelUsuario.ADMIN
    ).first()
    if not admin_vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem alterar as permissões de participantes."
        )

    membro_vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_id
    ).first()
    if not membro_vinculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participante não encontrado neste espaço."
        )

    novo_papel_str = papel_in.papel.lower().strip()
    if novo_papel_str in ["admin", "administrador"]:
        novo_papel = PapelUsuario.ADMIN
    elif novo_papel_str in ["membro", "participante"]:
        novo_papel = PapelUsuario.MEMBRO
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Papel inválido. Escolha 'administrador' ou 'participante'."
        )

    # Não permite rebaixar a si mesmo se for o único admin
    if usuario_atual.id == usuario_id and novo_papel != PapelUsuario.ADMIN:
        outros_admins = db.query(EspacoUsuario).filter(
            EspacoUsuario.espaco_id == espaco_id,
            EspacoUsuario.usuario_id != usuario_id,
            EspacoUsuario.papel == PapelUsuario.ADMIN
        ).count()
        if outros_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você é o único administrador deste espaço. Promova outro participante antes de deixar a administração."
            )

    membro_vinculo.papel = novo_papel
    db.commit()

    espaco = db.query(Espaco).filter(Espaco.id == espaco_id).first()
    db.refresh(espaco)
    return espaco


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

    if espaco_in.nome is not None:
        nome_normalizado = espaco_in.nome.strip()
        if not nome_normalizado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O nome do espaço não pode ser vazio."
            )

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

    if espaco_in.cor is not None:
        espaco.cor = espaco_in.cor.strip()

    if espaco_in.icone is not None:
        espaco.icone = espaco_in.icone.strip()

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

    db.query(Convite).filter(Convite.espaco_id == espaco_id).delete()
    db.query(EspacoUsuario).filter(EspacoUsuario.espaco_id == espaco_id).delete()
    db.delete(espaco)
    db.commit()
    return None


# =========================================================
# ORÇAMENTOS POR CATEGORIA DO ESPAÇO / GRUPO
# =========================================================

@router.get("/{espaco_id}/orcamento", response_model=OrcamentoEspacoResponse)
def obter_orcamento_espaco(
    espaco_id: int,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id
    ).first()
    if not vinculo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não possui acesso a este espaço."
        )

    config = db.query(OrcamentoEspacoConfig).filter(
        OrcamentoEspacoConfig.espaco_id == espaco_id
    ).first()

    cats = db.query(CategoriaEspaco).filter(
        CategoriaEspaco.espaco_id == espaco_id
    ).all()

    categorias_out = [
        CategoriaOrcamentoItem(
            id=c.id,
            nome=c.nome,
            limite=float(c.limite or 0.0),
            cor=c.cor
        )
        for c in cats
    ]

    espaco = db.query(Espaco).filter(Espaco.id == espaco_id).first()
    pode_editar = (vinculo.papel == PapelUsuario.ADMIN) or (espaco and espaco.criado_por == usuario_atual.id)

    return OrcamentoEspacoResponse(
        espaco_id=espaco_id,
        teto_geral=float(config.teto_geral) if config and config.teto_geral is not None else None,
        categorias=categorias_out,
        pode_editar=pode_editar
    )


@router.put("/{espaco_id}/orcamento", response_model=OrcamentoEspacoResponse)
def atualizar_orcamento_espaco(
    espaco_id: int,
    dados: OrcamentoEspacoUpdate,
    db: Session = Depends(get_db),
    usuario_atual: Usuario = Depends(get_current_user)
):
    espaco = db.query(Espaco).filter(Espaco.id == espaco_id).first()
    if not espaco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Espaço não encontrado."
        )

    vinculo = db.query(EspacoUsuario).filter(
        EspacoUsuario.espaco_id == espaco_id,
        EspacoUsuario.usuario_id == usuario_atual.id
    ).first()

    eh_admin = (vinculo and vinculo.papel == PapelUsuario.ADMIN) or (espaco.criado_por == usuario_atual.id)
    if not eh_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem ajustar o orçamento deste espaço."
        )

    config = db.query(OrcamentoEspacoConfig).filter(
        OrcamentoEspacoConfig.espaco_id == espaco_id
    ).first()

    if not config:
        config = OrcamentoEspacoConfig(
            espaco_id=espaco_id,
            teto_geral=dados.teto_geral
        )
        db.add(config)
    else:
        config.teto_geral = dados.teto_geral

    # Sincroniza as categorias do espaço
    db.query(CategoriaEspaco).filter(CategoriaEspaco.espaco_id == espaco_id).delete()

    for item in dados.categorias:
        nome_limpo = item.nome.strip()
        if nome_limpo:
            nova_cat = CategoriaEspaco(
                espaco_id=espaco_id,
                nome=nome_limpo,
                limite=max(0.0, float(item.limite or 0.0)),
                cor=item.cor or "#3B82F6"
            )
            db.add(nova_cat)

    db.commit()
    db.refresh(config)

    cats = db.query(CategoriaEspaco).filter(
        CategoriaEspaco.espaco_id == espaco_id
    ).all()

    categorias_out = [
        CategoriaOrcamentoItem(
            id=c.id,
            nome=c.nome,
            limite=float(c.limite or 0.0),
            cor=c.cor
        )
        for c in cats
    ]

    return OrcamentoEspacoResponse(
        espaco_id=espaco_id,
        teto_geral=float(config.teto_geral) if config.teto_geral is not None else None,
        categorias=categorias_out,
        pode_editar=True
    )