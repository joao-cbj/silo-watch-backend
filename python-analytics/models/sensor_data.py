from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)
    
    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}

class SensorDataModel(BaseModel):
    """Modelo para dados do sensor"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    temperatura: float = Field(..., description="Temperatura em °C")
    umidade: float = Field(..., description="Umidade relativa em %")
    dispositivo: str = Field(..., description="ID do dispositivo")
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class SensorDataResponse(BaseModel):
    """Resposta com dados do sensor"""
    temperatura: float
    umidade: float
    dispositivo: str
    timestamp: datetime
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True