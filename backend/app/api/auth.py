from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioResponse, Token, UsuarioUpdate, AlterarSenhaSchema
from app.core.security import get_password_hash, verify_password, create_access_token,SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@router.post("/cadastro", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    usuario_existente = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    novo_usuario = Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha=get_password_hash(usuario.senha)
    )
    
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    
    return novo_usuario

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    
    usuario = db.query(Usuario).filter(Usuario.email == form_data.username).first()
    
    if not usuario or not verify_password(form_data.password, usuario.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    
    token_jwt = create_access_token(data={"sub": str(usuario.id)})
    
    return {"access_token": token_jwt, "token_type": "bearer"}



def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Intercepta requisições, 
    decodifica o JWT e devolve o usuário logado para rotas protegidas.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        user_id = int(user_id_raw)
    except (JWTError, ValueError, TypeError):
        raise credentials_exception
        
    usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
    if usuario is None:
        raise credentials_exception
        
    return usuario

@router.get("/me", response_model=UsuarioResponse)
def obter_usuario_logado(usuario_atual: Usuario = Depends(get_current_user)):
    return usuario_atual

@router.put("/me", response_model=UsuarioResponse)
def atualizar_perfil(dados: UsuarioUpdate, usuario_atual: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if dados.nome and dados.nome.strip():
        usuario_atual.nome = dados.nome.strip()
        db.commit()
        db.refresh(usuario_atual)
    return usuario_atual

@router.put("/alterar-senha", status_code=status.HTTP_200_OK)
def alterar_senha(dados: AlterarSenhaSchema, usuario_atual: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(dados.senha_atual, usuario_atual.senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta."
        )
    usuario_atual.senha = get_password_hash(dados.nova_senha)
    db.commit()
    return {"message": "Senha alterada com sucesso!"}