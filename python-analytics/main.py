from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config.database import Database
from clients.openmeteo_client import OpenMeteoClient
import os
from datetime import datetime

# Instância global do cliente meteorológico
weather_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciar ciclo de vida da aplicação"""
    print("🚀 Iniciando API Python Analytics...")
    await Database.connect_db()

    global weather_client
    weather_client = OpenMeteoClient()

    from controllers.analytics_controller import router as analytics_router
    from controllers.metrics_controller import router as metrics_router 
    
    app.include_router(analytics_router)
    app.include_router(metrics_router)


    try:
        from controllers.forecast_controller import router as forecast_router
        app.include_router(forecast_router)
        print("✅ Rotas de previsão (Prophet) ativadas")
    except ImportError:
        print("⚠️ Prophet não instalado - rotas de previsão desabilitadas")

    print("✅ API pronta para receber requisições")
    yield

    # Encerramento
    print("🔌 Encerrando conexões...")
    await Database.close_db()
    if weather_client:
        await weather_client.close()
    print("👋 API encerrada")


app = FastAPI(
    title="Python Analytics API",
    description="API para análises avançadas de dados de sensores IoT",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Endpoint raiz"""
    return {
        "message": "Python Analytics API",
        "version": "1.0.0",
        "status": "online",
        "endpoints": {
            "docs": "/docs",
            "analytics": "/api/analytics"
        }
    }

@app.get("/health")
async def health_check():
    """Verificar saúde da API"""
    try:
        db = Database.get_database()
        await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": str(datetime.now())
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
