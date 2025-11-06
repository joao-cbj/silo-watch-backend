from __future__ import annotations
from typing import List, Dict, Optional, TYPE_CHECKING
from datetime import datetime, timedelta
from config.database import Database # Importa a classe Database
from bson import ObjectId

if TYPE_CHECKING:
    # Apenas para type hinting, evita a necessidade de import síncrono
    from motor.motor_asyncio import AsyncIOMotorCollection

class SensorRepository:
    """Repositório para operações com dados de sensores"""
    
    def __init__(self):
        # A coleção NÃO é inicializada aqui.
        # O construtor é rápido e não tenta conectar ao DB.
        pass
    
    @property
    def collection(self) -> AsyncIOMotorCollection:
        """Propriedade para acessar dinamicamente a coleção 'dados'."""
        # A chamada para get_collection agora acontece APENAS quando
        # um método assíncrono do repositório é invocado.
        return Database.get_collection("dados")
    
    async def get_by_device(
        self,
        device_id: str,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        # Usa o property self.collection
        cursor = self.collection.find(
            {"dispositivo": device_id}
        ).sort("timestamp", -1).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)
    
    async def get_by_date_range(
        self,
        device_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        cursor = self.collection.find({
            "dispositivo": device_id,
            "timestamp": {"$gte": start_date, "$lte": end_date}
        }).sort("timestamp", 1)
        return await cursor.to_list(length=None)
    
    async def get_last_hours(
        self,
        device_id: str,
        hours: int = 24
    ) -> List[Dict]:
        time_limit = datetime.now() - timedelta(hours=hours)
        cursor = self.collection.find({
            "dispositivo": device_id,
            "timestamp": {"$gte": time_limit}
        }).sort("timestamp", 1)
        return await cursor.to_list(length=None)
    
    async def get_all_devices(self) -> List[str]:
        # Usa o property self.collection
        return await self.collection.distinct("dispositivo")
    
    async def get_statistics(
        self,
        device_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        match_stage = {"dispositivo": device_id}
        if start_date and end_date:
            match_stage["timestamp"] = {"$gte": start_date, "$lte": end_date}

        pipeline = [
            {"$match": match_stage},
            {"$group": {
                "_id": "$dispositivo",
                "temp_media": {"$avg": "$temperatura"},
                "temp_min": {"$min": "$temperatura"},
                "temp_max": {"$max": "$temperatura"},
                "temp_stddev": {"$stdDevPop": "$temperatura"},
                "umidade_media": {"$avg": "$umidade"},
                "umidade_min": {"$min": "$umidade"},
                "umidade_max": {"$max": "$umidade"},
                "umidade_stddev": {"$stdDevPop": "$umidade"},
                "total_leituras": {"$sum": 1}
            }}
        ]
        # Usa o property self.collection
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        return result[0] if result else {}
    
    async def get_hourly_averages(
        self,
        device_id: str,
        days: int = 7
    ) -> List[Dict]:
        time_limit = datetime.now() - timedelta(days=days)
        pipeline = [
            {"$match": {
                "dispositivo": device_id,
                "timestamp": {"$gte": time_limit}
            }},
            {"$group": {
                "_id": {
                    "year": {"$year": "$timestamp"},
                    "month": {"$month": "$timestamp"},
                    "day": {"$dayOfMonth": "$timestamp"},
                    "hour": {"$hour": "$timestamp"}
                },
                "temp_media": {"$avg": "$temperatura"},
                "umidade_media": {"$avg": "$umidade"},
                "leituras": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        # Usa o property self.collection
        return await self.collection.aggregate(pipeline).to_list(length=None)
    
    async def get_daily_extremes(
        self,
        device_id: str,
        days: int = 30
    ) -> List[Dict]:
        time_limit = datetime.now() - timedelta(days=days)
        pipeline = [
            {"$match": {
                "dispositivo": device_id,
                "timestamp": {"$gte": time_limit}
            }},
            {"$group": {
                "_id": {
                    "year": {"$year": "$timestamp"},
                    "month": {"$month": "$timestamp"},
                    "day": {"$dayOfMonth": "$timestamp"}
                },
                "temp_max": {"$max": "$temperatura"},
                "temp_min": {"$min": "$temperatura"},
                "umidade_max": {"$max": "$umidade"},
                "umidade_min": {"$min": "$umidade"}
            }},
            {"$sort": {"_id": 1}}
        ]
        # Usa o property self.collection
        return await self.collection.aggregate(pipeline).to_list(length=None)
