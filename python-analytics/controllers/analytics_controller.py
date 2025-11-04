from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional
from services.analytics_service import AnalyticsService
from clients.openmeteo_client import OpenMeteoClient
from repositories.sensor_repository import SensorRepository
from schemas.analytics_schemas import (
    StatisticsResponse,
    AnomalyResponse,
    TrendResponse,
    CorrelationResponse,
    ComfortResponse
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

analytics_service = AnalyticsService()
weather_client = OpenMeteoClient()
sensor_repository = SensorRepository()

@router.get("/estatisticas/{device_id}", response_model=StatisticsResponse)
async def get_statistics(
    device_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Obter estatísticas detalhadas de um dispositivo
    
    - **device_id**: ID do dispositivo
    - **start_date**: Data inicial (formato: YYYY-MM-DD)
    - **end_date**: Data final (formato: YYYY-MM-DD)
    """
    try:
        start = datetime.fromisoformat(start_date) if start_date else None
        end = datetime.fromisoformat(end_date) if end_date else None
        
        stats = await analytics_service.get_basic_statistics(device_id, start, end)
        
        if "erro" in stats:
            raise HTTPException(status_code=404, detail=stats["erro"])
        
        return stats
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formato de data inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/anomalias/{device_id}", response_model=AnomalyResponse)
async def detect_anomalies(
    device_id: str,
    hours: int = Query(24, ge=1, le=168),
    threshold: float = Query(3.0, ge=1.0, le=5.0)
):
    """
    Detectar anomalias nos dados usando Z-score
    
    - **device_id**: ID do dispositivo
    - **hours**: Número de horas para análise (1-168)
    - **threshold**: Limite do Z-score para considerar anomalia (1.0-5.0)
    """
    try:
        anomalies = await analytics_service.detect_anomalies(device_id, hours, threshold)
        return anomalies
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tendencias/{device_id}", response_model=TrendResponse)
async def get_trends(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Análise de tendências usando regressão linear
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias para análise (1-30)
    """
    try:
        trends = await analytics_service.get_trends(device_id, days)
        
        if "erro" in trends:
            raise HTTPException(status_code=400, detail=trends["erro"])
        
        return trends
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/correlacao/{device_id}", response_model=CorrelationResponse)
async def get_correlation(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Análise de correlação entre temperatura e umidade
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias para análise (1-30)
    """
    try:
        correlation = await analytics_service.get_correlation_analysis(device_id, days)
        
        if "erro" in correlation:
            raise HTTPException(status_code=400, detail=correlation["erro"])
        
        return correlation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conforto/{device_id}", response_model=ComfortResponse)
async def get_comfort_analysis(
    device_id: str,
    hours: int = Query(24, ge=1, le=168)
):
    """
    Análise de conforto térmico
    
    - **device_id**: ID do dispositivo
    - **hours**: Número de horas para análise (1-168)
    """
    try:
        comfort = await analytics_service.get_comfort_analysis(device_id, hours)
        
        if "erro" in comfort:
            raise HTTPException(status_code=404, detail=comfort["erro"])
        
        return comfort
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/comparacao-clima/{device_id}")
async def compare_with_weather(
    device_id: str,
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180)
):
    """
    Comparar dados internos com clima externo (Open-Meteo)
    
    - **device_id**: ID do dispositivo
    - **latitude**: Latitude da localização
    - **longitude**: Longitude da localização
    """
    try:
        # Buscar última leitura do dispositivo
        data = await sensor_repository.get_by_device(device_id, limit=1)
        
        if not data:
            raise HTTPException(status_code=404, detail="Dispositivo sem dados")
        
        last_reading = data[0]
        internal_temp = last_reading['temperatura']
        internal_humidity = last_reading['umidade']
        
        # Comparar com clima externo
        comparison = await weather_client.compare_with_external(
            latitude,
            longitude,
            internal_temp,
            internal_humidity
        )
        
        return {
            "success": True,
            "dispositivo": device_id,
            **comparison
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/previsao-clima")
async def get_weather_forecast(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    days: int = Query(7, ge=1, le=16)
):
    """
    Obter previsão do tempo (Open-Meteo)
    
    - **latitude**: Latitude da localização
    - **longitude**: Longitude da localização
    - **days**: Número de dias de previsão (1-16)
    """
    try:
        forecast = await weather_client.get_weather_forecast(latitude, longitude, days)
        return {
            "success": True,
            "previsao": forecast
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/resumo-dispositivo/{device_id}")
async def get_device_summary(
    device_id: str,
    days: int = Query(7, ge=1, le=30)
):
    """
    Resumo completo com múltiplas análises
    
    - **device_id**: ID do dispositivo
    - **days**: Número de dias para análise
    """
    try:
        # Executar múltiplas análises em paralelo
        stats = await analytics_service.get_basic_statistics(device_id)
        trends = await analytics_service.get_trends(device_id, days)
        correlation = await analytics_service.get_correlation_analysis(device_id, days)
        anomalies = await analytics_service.detect_anomalies(device_id, days * 24)
        comfort = await analytics_service.get_comfort_analysis(device_id, days * 24)
        
        # Gerar insights
        insights = []
        
        if "temperatura" in trends and trends["temperatura"]["tendencia"] != "estável":
            insights.append(
                f"Temperatura {trends['temperatura']['tendencia']} "
                f"({trends['temperatura']['variacao_por_dia']:.2f}°C/dia)"
            )
        
        if "umidade" in trends and trends["umidade"]["tendencia"] != "estável":
            insights.append(
                f"Umidade {trends['umidade']['tendencia']} "
                f"({trends['umidade']['variacao_por_dia']:.2f}%/dia)"
            )
        
        if "total_anomalias" in anomalies and anomalies["total_anomalias"] > 0:
            insights.append(f"{anomalies['total_anomalias']} anomalias detectadas")
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "estatisticas": stats,
            "tendencias": trends,
            "correlacao": correlation,
            "anomalias": anomalies,
            "conforto": comfort,
            "insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dispositivos")
async def list_devices():
    """Listar todos os dispositivos disponíveis"""
    try:
        devices = await sensor_repository.get_all_devices()
        return {
            "success": True,
            "total": len(devices),
            "dispositivos": devices
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))