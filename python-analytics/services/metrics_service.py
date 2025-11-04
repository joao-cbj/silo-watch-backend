from typing import Dict, List
from repositories.sensor_repository import SensorRepository

class MetricsService:
    """Serviço para cálculo de métricas globais"""
    
    def __init__(self):
        self.repository = SensorRepository()
    
    async def get_global_metrics(self) -> Dict:
        """Calcular métricas globais de todos os dispositivos"""
        
        # Buscar últimas leituras de cada dispositivo
        devices = await self.repository.get_all_devices()
        
        if not devices:
            return self._empty_metrics()
        
        # Buscar última leitura de cada dispositivo
        all_readings = []
        for device_id in devices:
            readings = await self.repository.get_by_device(device_id, limit=1)
            if readings:
                all_readings.append(readings[0])
        
        if not all_readings:
            return self._empty_metrics()
        
        # Extrair valores
        temperaturas = [r['temperatura'] for r in all_readings]
        umidades = [r['umidade'] for r in all_readings]
        
        # Calcular estatísticas
        temp_media = sum(temperaturas) / len(temperaturas)
        umid_media = sum(umidades) / len(umidades)
        
        temp_min = min(temperaturas)
        temp_max = max(temperaturas)
        umid_min = min(umidades)
        umid_max = max(umidades)
        
        # Contar silos em alerta
        silos_em_alerta = sum(1 for r in all_readings 
                              if r['temperatura'] >= 35 or r['umidade'] >= 80)
        
        return {
            "silos_ativos": len(all_readings),
            "silos_em_alerta": silos_em_alerta,
            "temperatura": {
                "media": round(temp_media, 2),
                "minima": round(temp_min, 2),
                "maxima": round(temp_max, 2),
                "variacao": round(temp_max - temp_min, 2)
            },
            "umidade": {
                "media": round(umid_media, 2),
                "minima": round(umid_min, 2),
                "maxima": round(umid_max, 2),
                "variacao": round(umid_max - umid_min, 2)
            }
        }
    
    async def get_device_metrics(self, device_id: str, limit: int = 100) -> Dict:
        """Calcular métricas de um dispositivo específico"""
        
        readings = await self.repository.get_by_device(device_id, limit=limit)
        
        if not readings:
            return None
        
        temperaturas = [r['temperatura'] for r in readings]
        umidades = [r['umidade'] for r in readings]
        
        return {
            "dispositivo": device_id,
            "total_leituras": len(readings),
            "temperatura": {
                "media": round(sum(temperaturas) / len(temperaturas), 2),
                "minima": round(min(temperaturas), 2),
                "maxima": round(max(temperaturas), 2)
            },
            "umidade": {
                "media": round(sum(umidades) / len(umidades), 2),
                "minima": round(min(umidades), 2),
                "maxima": round(max(umidades), 2)
            },
            "ultima_leitura": readings[0]['timestamp'].isoformat()
        }
    
    def _empty_metrics(self) -> Dict:
        """Retornar métricas vazias"""
        return {
            "silos_ativos": 0,
            "silos_em_alerta": 0,
            "temperatura": {
                "media": 0,
                "minima": 0,
                "maxima": 0,
                "variacao": 0
            },
            "umidade": {
                "media": 0,
                "minima": 0,
                "maxima": 0,
                "variacao": 0
            }
        }