import re
from pydantic import BaseModel, EmailStr, field_validator

class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str

    @field_validator('senha')
    @classmethod
    def validar_senha(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('A senha deve ter pelo menos 8 caracteres.')
        if not re.search(r'[A-Z]', v):
            raise ValueError('A senha deve ter pelo menos uma letra maiúscula.')
        if not re.search(r'\d', v):
            raise ValueError('A senha deve ter pelo menos um número.')
        return v

class Token(BaseModel):
    access_token: str
    token_type: str

class UsuarioResponse(BaseModel):
    id: int
    nome: str
    email: str

    class Config:
        from_attributes = True