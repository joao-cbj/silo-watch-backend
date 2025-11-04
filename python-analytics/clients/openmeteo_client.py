import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import asyncio

class OpenMeteoClient:
    """Cliente para integração com Open-Meteo API"""
    
    BASE_URL = "https://api.open-meteo.com/v1"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """Fechar cliente HTTP"""
        await self.client.aclose()
    
    async def get_weather_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7
    ) -> Dict:
        """
        Obter previsão do tempo
        
        Args:
            latitude: Latitude da localização
            longitude: Longitude da localização
            days: Número de dias de previsão (1-16)
        
        Returns:
            Dicionário com dados meteorológicos
        """
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
            "timezone": "America/Recife",
            "forecast_days": days
        }
        
        try:
            response = await self.client.get(f"{self.BASE_URL}/forecast", params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Erro ao buscar previsão: {str(e)}")
    
    async def get_historical_weather(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Obter dados históricos do tempo
        
        Args:
            latitude: Latitude da localização
            longitude: Longitude da localização
            start_date: Data inicial (YYYY-MM-DD)
            end_date: Data final (YYYY-MM-DD)
        
        Returns:
            Dicionário com dados históricos
        """
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            "timezone": "America/Recife"
        }
        
        try:
            response = await self.client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params=params
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Erro ao buscar dados históricos: {str(e)}")
    
    async def get_current_weather(
        self,
        latitude: float,
        longitude: float
    ) -> Dict:
        """
        Obter condições climáticas atuais
        
        Args:
            latitude: Latitude da localização
            longitude: Longitude da localização
        
        Returns:
            Dicionário com dados atuais
        """
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            "timezone": "America/Recife"
        }
        
        try:
            response = await self.client.get(f"{self.BASE_URL}/forecast", params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Erro ao buscar clima atual: {str(e)}")
    
    async def compare_with_external(
        self,
        latitude: float,
        longitude: float,
        internal_temp: float,
        internal_humidity: float
    ) -> Dict:
        """
        Comparar dados internos com clima externo
        
        Returns:
            Análise comparativa
        """
        current = await self.get_current_weather(latitude, longitude)
        
        if "current" not in current:
            raise Exception("Dados atuais não disponíveis")
        
        external_temp = current["current"].get("temperature_2m")
        external_humidity = current["current"].get("relative_humidity_2m")
        
        return {
            "interno": {
                "temperatura": internal_temp,
                "umidade": internal_humidity
            },
            "externo": {
                "temperatura": external_temp,
                "umidade": external_humidity
            },
            "diferencas": {
                "temperatura": round(internal_temp - external_temp, 2) if external_temp else None,
                "umidade": round(internal_humidity - external_humidity, 2) if external_humidity else None
            },
            "timestamp": current["current"].get("time")
        }