import pandas as pd
from typing import Dict, List
from datetime import datetime, timedelta
from repositories.sensor_repository import SensorRepository
import warnings
warnings.filterwarnings('ignore')

class ForecastService:
    """Serviço para previsões e análises avançadas"""
    
    def __init__(self):
        self.repository = SensorRepository()
    
    async def forecast_temperature(
        self,
        device_id: str,
        days_history: int = 30,
        days_forecast: int = 7
    ) -> Dict:
        """
        Prever temperatura usando Prophet
        
        Args:
            device_id: ID do dispositivo
            days_history: Dias de histórico para treinar
            days_forecast: Dias para prever
        """
        try:
            from prophet import Prophet
            
            # Buscar dados históricos
            data = await self.repository.get_last_hours(device_id, days_history * 24)
            
            if not data or len(data) < 100:
                return {"erro": "Dados insuficientes para previsão (mínimo 100 leituras)"}
            
            # Preparar dados para Prophet
            df = pd.DataFrame(data)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.dropna(subset=['temperatura', 'timestamp'])
            
            if len(df) < 100:
                 return {"erro": "Dados insuficientes após limpeza (NaN)"}

            # Prophet requer colunas 'ds' (data) e 'y' (valor)
            prophet_df = pd.DataFrame({
                'ds': df['timestamp'],
                'y': df['temperatura']
            })
            
            # Criar e treinar modelo
            model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=False,
                changepoint_prior_scale=0.05
            )
            model.fit(prophet_df)
            
            # Criar dataframe para previsão
            future = model.make_future_dataframe(periods=days_forecast * 24, freq='H')
            forecast = model.predict(future)
            
            # Extrair apenas previsões futuras
            future_forecast = forecast[forecast['ds'] > prophet_df['ds'].max()]
            
            return {
                "dispositivo": device_id,
                "tipo": "temperatura",
                "dias_previstos": days_forecast,
                "previsoes": [
                    {
                        "timestamp": row['ds'].isoformat(),
                        "previsto": round(row['yhat'], 2),
                        "limite_inferior": round(row['yhat_lower'], 2),
                        "limite_superior": round(row['yhat_upper'], 2)
                    }
                    for _, row in future_forecast.iterrows()
                ],
                "metricas_modelo": {
                    "componentes": ["tendência", "sazonalidade_diária", "sazonalidade_semanal"]
                }
            }
        except ImportError:
            return {
                "erro": "Prophet não instalado. Execute: pip install prophet"
            }
        except Exception as e:
            return {"erro": f"Erro ao gerar previsão: {str(e)}"}
    
    async def forecast_humidity(
        self,
        device_id: str,
        days_history: int = 30,
        days_forecast: int = 7
    ) -> Dict:
        """Prever umidade usando Prophet"""
        try:
            from prophet import Prophet
            
            data = await self.repository.get_last_hours(device_id, days_history * 24)
            
            if not data or len(data) < 100:
                return {"erro": "Dados insuficientes"}
            
            df = pd.DataFrame(data)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.dropna(subset=['umidade', 'timestamp'])

            if len(df) < 100:
                 return {"erro": "Dados insuficientes após limpeza (NaN)"}
            
            prophet_df = pd.DataFrame({
                'ds': df['timestamp'],
                'y': df['umidade']
            })
            
            model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                changepoint_prior_scale=0.05
            )
            model.fit(prophet_df)
            
            future = model.make_future_dataframe(periods=days_forecast * 24, freq='H')
            forecast = model.predict(future)
            
            future_forecast = forecast[forecast['ds'] > prophet_df['ds'].max()]
            
            return {
                "dispositivo": device_id,
                "tipo": "umidade",
                "dias_previstos": days_forecast,
                "previsoes": [
                    {
                        "timestamp": row['ds'].isoformat(),
                        "previsto": round(row['yhat'], 2),
                        "limite_inferior": round(row['yhat_lower'], 2),
                        "limite_superior": round(row['yhat_upper'], 2)
                    }
                    for _, row in future_forecast.iterrows()
                ]
            }
        except ImportError:
            return {"erro": "Prophet não instalado"}
        except Exception as e:
            return {"erro": f"Erro: {str(e)}"}
    
    async def analyze_patterns(
        self,
        device_id: str,
        days: int = 30
    ) -> Dict:
        """Analisar padrões temporais"""
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data or len(data) < 100:
            return {"erro": "Dados insuficientes"}
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.dropna(subset=['temperatura', 'umidade', 'timestamp'])

        if len(df) < 100:
            return {"erro": "Dados insuficientes após limpeza (NaN)"}
            
        # Extrair componentes temporais
        df['hora'] = df['timestamp'].dt.hour
        df['dia_semana'] = df['timestamp'].dt.dayofweek
        df['dia_mes'] = df['timestamp'].dt.day
        
        # Análise por hora do dia
        hourly_pattern = df.groupby('hora').agg({
            'temperatura': ['mean', 'std'],
            'umidade': ['mean', 'std']
        }).round(2)
        
        # Análise por dia da semana
        weekly_pattern = df.groupby('dia_semana').agg({
            'temperatura': ['mean', 'std'],
            'umidade': ['mean', 'std']
        }).round(2)
        
        # Encontrar horários críticos
        temp_peak_hour = df.groupby('hora')['temperatura'].mean().idxmax()
        temp_low_hour = df.groupby('hora')['temperatura'].mean().idxmin()
        
        umid_peak_hour = df.groupby('hora')['umidade'].mean().idxmax()
        umid_low_hour = df.groupby('hora')['umidade'].mean().idxmin()
        
        # Garantir que temos dados para todas as 24h (preencher com 0 ou NaN se faltar)
        hourly_temp_data = hourly_pattern.get('temperatura', pd.DataFrame(columns=['mean', 'std'])).reindex(range(24))
        hourly_umid_data = hourly_pattern.get('umidade', pd.DataFrame(columns=['mean', 'std'])).reindex(range(24))

        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "padroes_horarios": {
                "temperatura": {
                    "hora_maxima": int(temp_peak_hour),
                    "hora_minima": int(temp_low_hour),
                    "por_hora": [
                        {
                            "hora": int(hora),
                            "media": float(hourly_temp_data.loc[hora, 'mean']) if pd.notna(hourly_temp_data.loc[hora, 'mean']) else None,
                            "desvio": float(hourly_temp_data.loc[hora, 'std']) if pd.notna(hourly_temp_data.loc[hora, 'std']) else None
                        }
                        for hora in range(24)
                    ]
                },
                "umidade": {
                    "hora_maxima": int(umid_peak_hour),
                    "hora_minima": int(umid_low_hour),
                    "por_hora": [
                        {
                            "hora": int(hora),
                            "media": float(hourly_umid_data.loc[hora, 'mean']) if pd.notna(hourly_umid_data.loc[hora, 'mean']) else None,
                            "desvio": float(hourly_umid_data.loc[hora, 'std']) if pd.notna(hourly_umid_data.loc[hora, 'std']) else None
                        }
                        for hora in range(24)
                    ]
                }
            },
            "insights": [
                f"Temperatura mais alta às {temp_peak_hour}h",
                f"Temperatura mais baixa às {temp_low_hour}h",
                f"Umidade mais alta às {umid_peak_hour}h",
                f"Umidade mais baixa às {umid_low_hour}h"
            ]
        }
    
    async def energy_analysis(
        self,
        device_id: str,
        days: int = 30,
        target_temp: float = 22.0,
        cost_per_kwh: float = 0.85
    ) -> Dict:
        """
        Análise de eficiência energética (estimativa)
        Calcula custo potencial de climatização
        """
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data or len(data) < 100:
            return {"erro": "Dados insuficientes"}
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.dropna(subset=['temperatura', 'timestamp'])

        if len(df) < 100:
            return {"erro": "Dados insuficientes após limpeza (NaN)"}
            
        # Calcular diferença da temperatura alvo
        df['delta_temp'] = abs(df['temperatura'] - target_temp)
        
        # Estimar consumo (simplificado: 0.1 kWh por °C de diferença por hora)
        # Esta é uma estimativa muito grosseira, idealmente usaria dados de potência
        df['consumo_estimado_kwh'] = df['delta_temp'] * 0.1
        df['custo_estimado'] = df['consumo_estimado_kwh'] * cost_per_kwh
        
        total_consumo = df['consumo_estimado_kwh'].sum()
        total_custo = df['custo_estimado'].sum()
        
        # Identificar períodos críticos
        df['periodo_critico'] = df['delta_temp'] > 5
        horas_criticas = df['periodo_critico'].sum()
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "temperatura_alvo": target_temp,
            "analise_energetica": {
                "consumo_total_estimado_kwh": round(total_consumo, 2),
                "custo_total_estimado_brl": round(total_custo, 2),
                "custo_medio_diario_brl": round(total_custo / days, 2),
                "horas_periodo_critico": int(horas_criticas),
                "percentual_critico": round((horas_criticas / len(df)) * 100, 2)
            },
            "recomendacoes": self._generate_energy_recommendations(
                df['delta_temp'].mean(),
                horas_criticas / len(df)
            )
        }
    
    def _generate_energy_recommendations(
        self,
        avg_delta: float,
        critical_ratio: float
    ) -> List[str]:
        """Gerar recomendações de economia energética"""
        recommendations = []
        
        if avg_delta > 5:
            recommendations.append(
                "Alta diferença média de temperatura. Considere melhorar isolamento térmico."
            )
        
        if critical_ratio > 0.3:
            recommendations.append(
                "Mais de 30% do tempo em período crítico. Avalie sistema de climatização."
            )
        
        if avg_delta < 2:
            recommendations.append(
                "Temperatura mantida próxima ao alvo. Ótimo controle térmico!"
            )
        
        recommendations.append(
            "Use cortinas/persianas para reduzir ganho térmico solar."
        )
        
        return recommendations
