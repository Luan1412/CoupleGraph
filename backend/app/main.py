from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base

from app.models import usuario, espaco  # noqa: F401

from app.api import auth
from app.api import espaco as espaco_router
from app.api import movimentacao as movimentacao_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CoupleGraph API",
    description="API para gestão financeira de casais",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(espaco_router.router)
app.include_router(movimentacao_router.router)

@app.get("/")
def root():
    return {"message": "Bem-vindo à API do CoupleGraph! 💚"}