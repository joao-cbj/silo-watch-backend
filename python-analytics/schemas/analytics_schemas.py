from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

class StatisticsResponse(BaseModel):
    """Schema para resposta de estatísticas"""
    dispositivo: str
    periodo: Dict[str, str]
    temperatura: Dict[str, Any]
    umidade: Dict[str, Any]
    total_leituras: int

class AnomalyItem(BaseModel):
    """Schema para item de anomalia"""
    timestamp: str
    tipo: str
    valor: float
    zscore: float
    gravidade: str

class AnomalyResponse(BaseModel):
    """Schema para resposta de anomalias"""
    dispositivo: str
    periodo_horas: int
    total_anomalias: int
    anomalias: List[AnomalyItem]

class TrendMetric(BaseModel):
    """Schema para métrica de tendência"""
    tendencia: str
    variacao_por_hora: float
    variacao_por_dia: float
    r_squared: float
    confiabilidade: str

class TrendResponse(BaseModel):
    """Schema para resposta de tendências"""
    dispositivo: str
    periodo_dias: int
    temperatura: TrendMetric
    umidade: TrendMetric

class CorrelationMetric(BaseModel):
    """Schema para métrica de correlação"""
    coeficiente: float
    p_valor: float
    significativo: bool
    interpretacao: str

class CorrelationResponse(BaseModel):
    """Schema para resposta de correlação"""
    dispositivo: str
    periodo_dias: int
    correlacao_pearson: CorrelationMetric
    correlacao_spearman: CorrelationMetric

class ComfortResponse(BaseModel):
    """Schema para resposta de conforto"""
    dispositivo: str
    periodo_horas: int
    indice_medio: float
    distribuicao_conforto: Dict[str, float]
    percentual_confortavel: float
    recomendacoes: List[str]