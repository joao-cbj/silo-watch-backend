from __future__ import annotations
from typing import Optional, TYPE_CHECKING
import os
from dotenv import load_dotenv

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection

load_dotenv()

class Database:
    """Gerenciador de conexão MongoDB"""
    
    client: Optional[AsyncIOMotorClient] = None  # type: ignore 

    @classmethod
    async def connect_db(cls) -> None:
        """Conectar ao MongoDB"""
        if cls.client is None:
            mongodb_uri = os.getenv("MONGODB_URI")
            if not mongodb_uri:
                raise ValueError("MONGODB_URI não definida no .env")

            from motor.motor_asyncio import AsyncIOMotorClient
            cls.client = AsyncIOMotorClient(mongodb_uri)
            print("✅ MongoDB conectado com sucesso")

    @classmethod
    async def close_db(cls) -> None:
        """Fechar conexão com MongoDB"""
        if cls.client:
            cls.client.close()
            cls.client = None
            print("🔌 Conexão MongoDB fechada")

    @classmethod
    def get_database(cls) -> AsyncIOMotorDatabase:  # type: ignore 
        """Obter instância do banco de dados"""
        if cls.client is None:
            raise Exception("Database não está conectado")
        db_name = os.getenv("DB_NAME", "silowatch")
        return cls.client[db_name]

    @classmethod
    def get_collection(cls, collection_name: str) -> AsyncIOMotorCollection:  # type: ignore 
        """Obter coleção específica"""
        db = cls.get_database()
        return db[collection_name]