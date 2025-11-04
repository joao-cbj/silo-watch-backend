from fastapi import APIRouter, HTTPException, Query
from services.metrics_service import MetricsService

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])

metrics_service = MetricsService()

@router.get("/global")
async def get_global_metrics():
    """
    Obter métricas globais de todos os silos
    
    Retorna:
    - Total de silos ativos
    - Silos em alerta
    - Média, mínima e máxima de temperatura
    - Média, mínima e máxima de umidade
    - Variações
    """
    try:
        metrics = await metrics_service.get_global_metrics()
        return {
            "success": True,
            "data": metrics
        }
    except Exception as e:
        print(f"❌ Erro em get_global_metrics: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dispositivo/{device_id}")
async def get_device_metrics(
    device_id: str,
    limit: int = Query(100, ge=10, le=1000, description="Número de leituras para análise")
):
    """
    Obter métricas de um dispositivo específico
    
    - **device_id**: ID do dispositivo
    - **limit**: Número de leituras para análise (10-1000)
    """
    try:
        metrics = await metrics_service.get_device_metrics(device_id, limit)
        
        if not metrics:
            raise HTTPException(
                status_code=404, 
                detail=f"Dispositivo {device_id} não encontrado ou sem dados"
            )
        
        return {
            "success": True,
            "data": metrics
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em get_device_metrics: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))