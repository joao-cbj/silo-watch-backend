import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from scipy import stats
from sklearn.linear_model import LinearRegression
from repositories.sensor_repository import SensorRepository
import warnings
warnings.filterwarnings('ignore')

class AnalyticsService:
    """Serviço para análises estatísticas e insights"""
    
    def __init__(self):
        self.repository = SensorRepository()
    
    def _to_dataframe(self, data: List[Dict]) -> pd.DataFrame:
        """Converter dados para DataFrame pandas"""
        if not data:
            return pd.DataFrame()
        
        df = pd.DataFrame(data)
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp')
        
        return df
    
    async def get_basic_statistics(
        self,
        device_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Estatísticas básicas (média, mediana, desvio padrão, etc.)"""
        
        if start_date and end_date:
            data = await self.repository.get_by_date_range(device_id, start_date, end_date)
        else:
            data = await self.repository.get_last_hours(device_id, 24)
        
        if not data:
            return {"erro": "Nenhum dado encontrado"}
        
        df = self._to_dataframe(data)
        
        return {
            "dispositivo": device_id,
            "periodo": {
                "inicio": df['timestamp'].min().isoformat(),
                "fim": df['timestamp'].max().isoformat()
            },
            "temperatura": {
                "media": round(df['temperatura'].mean(), 2),
                "mediana": round(df['temperatura'].median(), 2),
                "desvio_padrao": round(df['temperatura'].std(), 2),
                "minimo": round(df['temperatura'].min(), 2),
                "maximo": round(df['temperatura'].max(), 2),
                "quartis": {
                    "q1": round(df['temperatura'].quantile(0.25), 2),
                    "q2": round(df['temperatura'].quantile(0.50), 2),
                    "q3": round(df['temperatura'].quantile(0.75), 2)
                }
            },
            "umidade": {
                "media": round(df['umidade'].mean(), 2),
                "mediana": round(df['umidade'].median(), 2),
                "desvio_padrao": round(df['umidade'].std(), 2),
                "minimo": round(df['umidade'].min(), 2),
                "maximo": round(df['umidade'].max(), 2),
                "quartis": {
                    "q1": round(df['umidade'].quantile(0.25), 2),
                    "q2": round(df['umidade'].quantile(0.50), 2),
                    "q3": round(df['umidade'].quantile(0.75), 2)
                }
            },
            "total_leituras": len(df)
        }
    
    async def detect_anomalies(
        self,
        device_id: str,
        hours: int = 24,
        threshold: float = 3.0
    ) -> Dict:
        """Detectar anomalias usando Z-score"""
        try:
            data = await self.repository.get_last_hours(device_id, hours)
            
            if not data or len(data) < 3:
                return {
                    "dispositivo": device_id,
                    "periodo_horas": hours,
                    "total_anomalias": 0,
                    "anomalias": []
                }
            
            df = self._to_dataframe(data)
            
            # Verificar se há dados suficientes
            if len(df) < 3:
                return {
                    "dispositivo": device_id,
                    "periodo_horas": hours,
                    "total_anomalias": 0,
                    "anomalias": []
                }
            
            # Calcular Z-score com tratamento de erro
            try:
                df['temp_zscore'] = np.abs(stats.zscore(df['temperatura'], nan_policy='omit'))
                df['umid_zscore'] = np.abs(stats.zscore(df['umidade'], nan_policy='omit'))
            except Exception as e:
                print(f"⚠️ Erro ao calcular Z-score: {e}")
                return {
                    "dispositivo": device_id,
                    "periodo_horas": hours,
                    "total_anomalias": 0,
                    "anomalias": []
                }
            
            # Detectar anomalias
            temp_anomalies = df[df['temp_zscore'] > threshold]
            umid_anomalies = df[df['umid_zscore'] > threshold]
            
            anomalies = []
            
            for _, row in temp_anomalies.iterrows():
                anomalies.append({
                    "timestamp": row['timestamp'].isoformat(),
                    "tipo": "temperatura",
                    "valor": round(float(row['temperatura']), 2),
                    "zscore": round(float(row['temp_zscore']), 2),
                    "gravidade": "alta" if row['temp_zscore'] > 4 else "moderada"
                })
            
            for _, row in umid_anomalies.iterrows():
                anomalies.append({
                    "timestamp": row['timestamp'].isoformat(),
                    "tipo": "umidade",
                    "valor": round(float(row['umidade']), 2),
                    "zscore": round(float(row['umid_zscore']), 2),
                    "gravidade": "alta" if row['umid_zscore'] > 4 else "moderada"
                })
            
            return {
                "dispositivo": device_id,
                "periodo_horas": hours,
                "total_anomalias": len(anomalies),
                "anomalias": sorted(anomalies, key=lambda x: x['timestamp'], reverse=True)
            }
        except Exception as e:
            print(f"❌ Erro em detect_anomalies: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "dispositivo": device_id,
                "periodo_horas": hours,
                "total_anomalias": 0,
                "anomalias": [],
                "erro": str(e)
            }
    
    async def get_trends(
        self,
        device_id: str,
        days: int = 7
    ) -> Dict:
        """Análise de tendências usando regressão linear"""
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data or len(data) < 10:
            return {"erro": "Dados insuficientes para análise de tendência"}
        
        df = self._to_dataframe(data)
        
        # Preparar dados para regressão
        df['timestamp_numeric'] = (df['timestamp'] - df['timestamp'].min()).dt.total_seconds()
        
        X = df['timestamp_numeric'].values.reshape(-1, 1)
        
        # Regressão para temperatura
        temp_model = LinearRegression()
        temp_model.fit(X, df['temperatura'].values)
        temp_slope = temp_model.coef_[0]
        temp_r2 = temp_model.score(X, df['temperatura'].values)
        
        # Regressão para umidade
        umid_model = LinearRegression()
        umid_model.fit(X, df['umidade'].values)
        umid_slope = umid_model.coef_[0]
        umid_r2 = umid_model.score(X, df['umidade'].values)
        
        # Converter tendência para unidade por hora
        temp_trend_per_hour = temp_slope * 3600
        umid_trend_per_hour = umid_slope * 3600
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "temperatura": {
                "tendencia": "aumentando" if temp_slope > 0 else "diminuindo" if temp_slope < 0 else "estável",
                "variacao_por_hora": round(temp_trend_per_hour, 4),
                "variacao_por_dia": round(temp_trend_per_hour * 24, 2),
                "r_squared": round(temp_r2, 4),
                "confiabilidade": "alta" if temp_r2 > 0.7 else "moderada" if temp_r2 > 0.4 else "baixa"
            },
            "umidade": {
                "tendencia": "aumentando" if umid_slope > 0 else "diminuindo" if umid_slope < 0 else "estável",
                "variacao_por_hora": round(umid_trend_per_hour, 4),
                "variacao_por_dia": round(umid_trend_per_hour * 24, 2),
                "r_squared": round(umid_r2, 4),
                "confiabilidade": "alta" if umid_r2 > 0.7 else "moderada" if umid_r2 > 0.4 else "baixa"
            }
        }
    
    async def get_correlation_analysis(
        self,
        device_id: str,
        days: int = 7
    ) -> Dict:
        """Análise de correlação entre temperatura e umidade"""
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data or len(data) < 10:
            return {"erro": "Dados insuficientes"}
        
        df = self._to_dataframe(data)
        
        # Correlação de Pearson
        pearson_corr, pearson_pvalue = stats.pearsonr(df['temperatura'], df['umidade'])
        
        # Correlação de Spearman
        spearman_corr, spearman_pvalue = stats.spearmanr(df['temperatura'], df['umidade'])
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "correlacao_pearson": {
                "coeficiente": round(pearson_corr, 4),
                "p_valor": round(pearson_pvalue, 6),
                "significativo": pearson_pvalue < 0.05,
                "interpretacao": self._interpret_correlation(pearson_corr)
            },
            "correlacao_spearman": {
                "coeficiente": round(spearman_corr, 4),
                "p_valor": round(spearman_pvalue, 6),
                "significativo": spearman_pvalue < 0.05,
                "interpretacao": self._interpret_correlation(spearman_corr)
            }
        }
    
    def _interpret_correlation(self, corr: float) -> str:
        """Interpretar coeficiente de correlação"""
        abs_corr = abs(corr)
        direction = "negativa" if corr < 0 else "positiva"
        
        if abs_corr >= 0.9:
            return f"Correlação {direction} muito forte"
        elif abs_corr >= 0.7:
            return f"Correlação {direction} forte"
        elif abs_corr >= 0.5:
            return f"Correlação {direction} moderada"
        elif abs_corr >= 0.3:
            return f"Correlação {direction} fraca"
        else:
            return "Correlação muito fraca ou inexistente"
    
    async def get_comfort_analysis(
        self,
        device_id: str,
        hours: int = 24
    ) -> Dict:
        """Análise de conforto térmico baseado em índices"""
        data = await self.repository.get_last_hours(device_id, hours)
        
        if not data:
            return {"erro": "Nenhum dado encontrado"}
        
        df = self._to_dataframe(data)
        
        # Calcular índice de desconforto (Heat Index simplificado)
        df['indice_desconforto'] = df.apply(
            lambda row: self._calculate_heat_index(row['temperatura'], row['umidade']),
            axis=1
        )
        
        # Classificar conforto
        df['conforto'] = df['indice_desconforto'].apply(self._classify_comfort)
        
        comfort_distribution = df['conforto'].value_counts().to_dict()
        
        return {
            "dispositivo": device_id,
            "periodo_horas": hours,
            "indice_medio": round(df['indice_desconforto'].mean(), 2),
            "distribuicao_conforto": comfort_distribution,
            "percentual_confortavel": round(
                (comfort_distribution.get('confortável', 0) / len(df)) * 100, 2
            ),
            "recomendacoes": self._generate_comfort_recommendations(df)
        }
    
    def _calculate_heat_index(self, temp: float, humidity: float) -> float:
        """Calcular índice de calor simplificado"""
        # Fórmula simplificada do Heat Index
        hi = temp + (0.5555 * (6.11 * np.exp(5417.7530 * ((1/273.16) - (1/(temp+273.15)))) * (humidity/100) - 10))
        return hi
    
    def _classify_comfort(self, heat_index: float) -> str:
        """Classificar nível de conforto"""
        if heat_index < 24:
            return "muito confortável"
        elif heat_index < 27:
            return "confortável"
        elif heat_index < 30:
            return "levemente desconfortável"
        elif heat_index < 33:
            return "desconfortável"
        else:
            return "muito desconfortável"
    
    def _generate_comfort_recommendations(self, df: pd.DataFrame) -> List[str]:
        """Gerar recomendações baseadas nos dados"""
        recommendations = []
        
        avg_temp = df['temperatura'].mean()
        avg_humidity = df['umidade'].mean()
        
        if avg_temp > 26:
            recommendations.append("Temperatura acima do ideal. Considere melhorar a ventilação ou climatização.")
        if avg_temp < 18:
            recommendations.append("Temperatura abaixo do ideal. Considere aquecimento do ambiente.")
        if avg_humidity > 70:
            recommendations.append("Umidade alta. Considere uso de desumidificador.")
        if avg_humidity < 30:
            recommendations.append("Umidade baixa. Considere uso de umidificador.")
        
        if not recommendations:
            recommendations.append("Condições ambientais dentro dos parâmetros ideais.")
        
        return recommendations