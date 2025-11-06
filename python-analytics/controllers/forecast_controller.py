from fastapi import APIRouter, HTTPException, Query
from services.forecast_service import ForecastService


router = APIRouter(prefix="/api/forecast", tags=["Forecast & Advanced Analytics"])

forecast_service = ForecastService()

@router.get("/temperatura/{device_id}")
async def forecast_temperature(
    device_id: str,
    days_history: int = Query(30, ge=7, le=90),
    days_forecast: int = Query(7, ge=1, le=30)
):
    """
    Prever temperatura usando Prophet
    
    - **device_id**: ID do dispositivo
    - **days_history**: Dias de histórico para treinar (7-90)
    - **days_forecast**: Dias para prever (1-30)
    
    Requer: pip install prophet
    """
    try:
        result = await forecast_service.forecast_temperature(
            device_id,
            days_history,
            days_forecast
        )
        
        if "erro" in result:
            raise HTTPException(status_code=400, detail=result["erro"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/umidade/{device_id}")
async def forecast_humidity(
    device_id: str,
    days_history: int = Query(30, ge=7, le=90),
    days_forecast: int = Query(7, ge=1, le=30)
):
    """
    Prever umidade usando Prophet
    
    - **device_id**: ID do dispositivo
    - **days_history**: Dias de histórico (7-90)
    - **days_forecast**: Dias para prever (1-30)
    """
    try:
        result = await forecast_service.forecast_humidity(
            device_id,
            days_history,
            days_forecast
        )
        
        if "erro" in result:
            raise HTTPException(status_code=400, detail=result["erro"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/padroes/{device_id}")
async def analyze_patterns(
    device_id: str,
    days: int = Query(30, ge=7, le=90)
):
    """
    Analisar padrões temporais (horário, semanal)
    
    - **device_id**: ID do dispositivo
    - **days**: Período de análise (7-90 dias)
    
    Identifica:
    - Horários de pico e mínimo
    - Padrões por hora do dia
    - Padrões por dia da semana
    """
    try:
        result = await forecast_service.analyze_patterns(device_id, days)
        
        if "erro" in result:
            raise HTTPException(status_code=400, detail=result["erro"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/energia/{device_id}")
async def energy_analysis(
    device_id: str,
    days: int = Query(30, ge=7, le=90),
    target_temp: float = Query(22.0, ge=15.0, le=30.0),
    cost_per_kwh: float = Query(0.85, ge=0.1, le=5.0)
):
    """
    Análise de eficiência energética
    
    - **device_id**: ID do dispositivo
    - **days**: Período de análise (7-90)
    - **target_temp**: Temperatura alvo (15-30°C)
    - **cost_per_kwh**: Custo por kWh em BRL (0.1-5.0)
    
    Estima custo de climatização para manter temperatura alvo
    """
    try:
        result = await forecast_service.energy_analysis(
            device_id,
            days,
            target_temp,
            cost_per_kwh
        )
        
        if "erro" in result:
            raise HTTPException(status_code=400, detail=result["erro"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/completo/{device_id}")
async def full_forecast_analysis(
    device_id: str,
    days_history: int = Query(30, ge=7, le=90),
    days_forecast: int = Query(7, ge=1, le=14)
):
    """
    Análise completa: previsões + padrões + energia
    
    - **device_id**: ID do dispositivo
    - **days_history**: Dias de histórico
    - **days_forecast**: Dias para prever
    """
    try:
        # Executar múltiplas análises
        temp_forecast = await forecast_service.forecast_temperature(
            device_id,
            days_history,
            days_forecast
        )
        
        humidity_forecast = await forecast_service.forecast_humidity(
            device_id,
            days_history,
            days_forecast
        )
        
        patterns = await forecast_service.analyze_patterns(
            device_id,
            days_history
        )
        
        energy = await forecast_service.energy_analysis(
            device_id,
            days_history
        )
        
        return {
            "dispositivo": device_id,
            "previsao_temperatura": temp_forecast if "erro" not in temp_forecast else None,
            "previsao_umidade": humidity_forecast if "erro" not in humidity_forecast else None,
            "padroes": patterns if "erro" not in patterns else None,
            "analise_energetica": energy if "erro" not in energy else None,
            "alertas": [],  # Pode adicionar alertas baseados nas análises
            "resumo": {
                "previsoes_disponiveis": "erro" not in temp_forecast,
                "padroes_identificados": "erro" not in patterns,
                "economia_estimada": "erro" not in energy
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
