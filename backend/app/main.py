from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.models.usuario import Usuario
from app.models.espaco import Espaco
from app.api import auth, espaco

app = FastAPI(
    title="CoupleGraph API",
    description="API para gestão financeira de casais",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(espaco.router)

@app.get("/")
def root():
    return {"message": "Bem-vindo à API do CoupleGraph! 💚"}