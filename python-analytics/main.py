from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config.database import Database
from controllers.analytics_controller import router as analytics_router
from clients.openmeteo_client import OpenMeteoClient
import os

# Instância global do cliente weather
weather_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciar lifecycle da aplicação"""
    # Startup
    print("🚀 Iniciando API Python Analytics...")
    await Database.connect_db()
    
    global weather_client
    weather_client = OpenMeteoClient()
    
    print("✅ API pronta para receber requisições")
    
    yield
    
    # Shutdown
    print("🔌 Encerrando conexões...")
    await Database.close_db()
    if weather_client:
        await weather_client.close()
    print("👋 API encerrada")

# Criar aplicação FastAPI
app = FastAPI(
    title="Python Analytics API",
    description="API para análises avançadas de dados de sensores IoT",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique os domínios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(analytics_router)

# Importar rota de métricas
from controllers.metrics_controller import router as metrics_router
app.include_router(metrics_router)

# Importar rota de indicadores
from controllers.indicators_controller import router as indicators_router
app.include_router(indicators_router)

# Importar e incluir rota de forecast (opcional se Prophet instalado)
try:
    from controllers.forecast_controller import router as forecast_router
    app.include_router(forecast_router)
    print("✅ Rotas de previsão (Prophet) ativadas")
except ImportError:
    print("⚠️  Prophet não instalado - rotas de previsão desabilitadas")

# Rota raiz
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

# Health check
@app.get("/health")
async def health_check():
    """Verificar saúde da API"""
    try:
        # Testar conexão com banco
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
    from datetime import datetime
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )