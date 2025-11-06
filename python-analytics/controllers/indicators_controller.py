from fastapi import APIRouter, HTTPException, Query
from services.indicators_service import IndicatorsService


router = APIRouter(prefix="/api/indicators", tags=["Indicators"])

indicators_service = IndicatorsService()

@router.get("/amplitude-termica/{device_id}")
async def get_thermal_amplitude(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Amplitude Térmica Diária
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias (1-30)
    
    Retorna máx-mín de cada dia para medir estabilidade
    """
    try:
        result = await indicators_service.get_thermal_amplitude(device_id, days)
        
        if "erro" in result:
            return {"success": False, **result}
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/taxa-umidade/{device_id}")
async def get_humidity_rate(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Taxa de Aumento de Umidade (ΔU/Δt)
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias (1-30)
    
    Calcula mudança percentual por hora/dia
    """
    try:
        result = await indicators_service.get_humidity_rate(device_id, days)
        
        if "erro" in result:
            return {"success": False, **result}
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/indice-fungos/{device_id}")
async def get_fungus_risk_index(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Índice de Risco de Fungos (IRF)
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias (1-30)
    
    Função de T > 30°C e UR > 75%
    """
    try:
        result = await indicators_service.get_fungus_risk_index(device_id, days)
        
        if "erro" in result:
            return {"success": False, **result}
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tempo-critico/{device_id}")
async def get_critical_time(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Horas Acima de Limite Crítico (TAC)
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias (1-30)
    
    Tempo acumulado com T > 35°C
    """
    try:
        result = await indicators_service.get_critical_time_above_limit(device_id, days)
        
        if "erro" in result:
            return {"success": False, **result}
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))