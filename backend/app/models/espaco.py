from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Enum, UniqueConstraint
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func
import enum
from app.core.database import Base 
from app.models.usuario import Usuario

class PapelUsuario(str, enum.Enum):
    ADMIN = "administrador"
    MEMBRO = "participante"

class TipoMovimentacao(str, enum.Enum):
    RECEITA = "receita"
    DESPESA = "despesa"

class StatusConvite(str, enum.Enum):
    PENDENTE = "pendente"
    ACEITO = "aceito"
    RECUSADO = "recusado"

class Espaco(Base):
    __tablename__ = "espacos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    cor = Column(String(30), nullable=True, default="#3B82F6")
    icone = Column(String(50), nullable=True, default="casal")
    criado_por = Column(Integer, ForeignKey("usuarios.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    criador = relationship("Usuario", foreign_keys=[criado_por])
    membros = relationship("EspacoUsuario", back_populates="espaco", cascade="all, delete-orphan")
    movimentacoes = relationship("Movimentacao", back_populates="espaco", cascade="all, delete-orphan")
    convites = relationship("Convite", back_populates="espaco", cascade="all, delete-orphan")
    orcamento_config = relationship("OrcamentoEspacoConfig", back_populates="espaco", uselist=False, cascade="all, delete-orphan")
    categorias_orcamento = relationship("CategoriaEspaco", back_populates="espaco", cascade="all, delete-orphan")

    @property
    def total_membros(self) -> int:
        return len(self.membros) if self.membros else 1

    @property
    def saldo(self) -> float:
        if not self.movimentacoes:
            return 0.0
        rec = sum(float(m.valor) for m in self.movimentacoes if m.tipo == TipoMovimentacao.RECEITA)
        desp = sum(float(m.valor) for m in self.movimentacoes if m.tipo == TipoMovimentacao.DESPESA)
        return rec - desp

    @property
    def despesas(self) -> float:
        if not self.movimentacoes:
            return 0.0
        return sum(float(m.valor) for m in self.movimentacoes if m.tipo == TipoMovimentacao.DESPESA)

    @property
    def membros_detalhes(self):
        resultado = []
        emails_registrados = set()

        if self.membros:
            for vinc in self.membros:
                if vinc.usuario:
                    em = (vinc.usuario.email or "").strip().lower()
                    emails_registrados.add(em)
                    resultado.append({
                        "usuario_id": vinc.usuario.id,
                        "convite_id": None,
                        "nome": vinc.usuario.nome,
                        "email": vinc.usuario.email,
                        "papel": vinc.papel.value if hasattr(vinc.papel, "value") else str(vinc.papel),
                        "status": "ativo"
                    })

        if self.convites:
            for conv in self.convites:
                if conv.status == StatusConvite.PENDENTE:
                    em_conv = (conv.email or "").strip().lower()
                    if em_conv not in emails_registrados:
                        user_id = None
                        if hasattr(conv, "destinatario_usuario") and conv.destinatario_usuario and conv.destinatario_usuario.nome:
                            nome_exib = conv.destinatario_usuario.nome
                            user_id = conv.destinatario_usuario.id
                        else:
                            nome_exib = conv.email.split('@')[0].replace('.', ' ').replace('_', ' ').title()

                        resultado.append({
                            "usuario_id": user_id,
                            "convite_id": conv.id,
                            "nome": nome_exib,
                            "email": conv.email,
                            "papel": "participante",
                            "status": "pendente"
                        })

        return resultado


class EspacoUsuario(Base):
    __tablename__ = "espaco_usuarios"
    __table_args__ = (UniqueConstraint("espaco_id", "usuario_id", name="uq_espaco_usuario"),)

    id = Column(Integer, primary_key=True, index=True)
    espaco_id = Column(Integer, ForeignKey("espacos.id"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    papel = Column(Enum(PapelUsuario), default=PapelUsuario.MEMBRO)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    espaco = relationship("Espaco", back_populates="membros")
    usuario = relationship("Usuario")


class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id = Column(Integer, primary_key=True, index=True)
    espaco_id = Column(Integer, ForeignKey("espacos.id"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    tipo = Column(Enum(TipoMovimentacao), nullable=False)
    descricao = Column(String(255), nullable=True)
    valor = Column(Numeric(12, 2), nullable=False)
    categoria = Column(String(100), nullable=False)
    data = Column(DateTime(timezone=True), default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    espaco = relationship("Espaco", back_populates="movimentacoes")
    usuario = relationship("Usuario")


class Convite(Base):
    __tablename__ = "convites"

    id = Column(Integer, primary_key=True, index=True)
    espaco_id = Column(Integer, ForeignKey("espacos.id"))
    email = Column(String(255), nullable=False)
    convidado_por = Column(Integer, ForeignKey("usuarios.id"))
    status = Column(Enum(StatusConvite), default=StatusConvite.PENDENTE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    espaco = relationship("Espaco", back_populates="convites")
    remetente = relationship("Usuario", foreign_keys=[convidado_por])
    destinatario_usuario = relationship(
        "Usuario",
        primaryjoin="foreign(Convite.email) == Usuario.email",
        viewonly=True,
        uselist=False
    )

    @property
    def espaco_nome(self) -> str:
        return self.espaco.nome if self.espaco else "Espaço"

    @property
    def convidado_por_nome(self) -> str:
        return self.remetente.nome if self.remetente else "Usuário"

    @property
    def convidado_por_email(self) -> str:
        return self.remetente.email if self.remetente else ""


class OrcamentoEspacoConfig(Base):
    __tablename__ = "orcamento_espaco_configs"

    id = Column(Integer, primary_key=True, index=True)
    espaco_id = Column(Integer, ForeignKey("espacos.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    teto_geral = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    espaco = relationship("Espaco", back_populates="orcamento_config")


class CategoriaEspaco(Base):
    __tablename__ = "categorias_espaco"

    id = Column(Integer, primary_key=True, index=True)
    espaco_id = Column(Integer, ForeignKey("espacos.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)
    limite = Column(Numeric(12, 2), default=0.00, nullable=False)
    cor = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    espaco = relationship("Espaco", back_populates="categorias_orcamento")