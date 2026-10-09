from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base 

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
    nome = Column(String, nullable=False)
    criado_por = Column(Integer, ForeignKey("usuarios.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    criador = relationship("Usuario", foreign_keys=[criado_por])
    membros = relationship("EspacoUsuario", back_populates="espaco")
    movimentacoes = relationship("Movimentacao", back_populates="espaco")
    convites = relationship("Convite", back_populates="espaco")


class EspacoUsuario(Base):
    __tablename__ = "espaco_usuarios"

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
    descricao = Column(String, nullable=False)
    valor = Column(Float, nullable=False)
    categoria = Column(String, nullable=False)
    data = Column(DateTime(timezone=True), default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    espaco = relationship("Espaco", back_populates="movimentacoes")
    usuario = relationship("Usuario")


class Convite(Base):
    __tablename__ = "convites"

    id = Column(Integer, primary_key=True, index=True)
    espaco_id = Column(Integer, ForeignKey("espacos.id"))
    email = Column(String, nullable=False)
    convidado_por = Column(Integer, ForeignKey("usuarios.id"))
    status = Column(Enum(StatusConvite), default=StatusConvite.PENDENTE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    espaco = relationship("Espaco", back_populates="convites")