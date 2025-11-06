import pandas as pd
import numpy as np
from typing import Dict, List
from datetime import datetime, timedelta
from repositories.sensor_repository import SensorRepository

class IndicatorsService:
    """Serviço para indicadores avançados de qualidade e risco"""
    
    def __init__(self):
        self.repository = SensorRepository()
    
    async def get_thermal_amplitude(self, device_id: str, days: int = 7) -> Dict:
        """
        Amplitude Térmica Diária
        Cálculo: Máx - Mín do dia
        """
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data or len(data) < 24:
            return {"erro": "Dados insuficientes (mínimo 24h)"}
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['date'] = df['timestamp'].dt.date
        
        # Calcular amplitude por dia
        daily_stats = df.groupby('date')['temperatura'].agg(['min', 'max']).reset_index()
        daily_stats['amplitude'] = daily_stats['max'] - daily_stats['min']
        
        amplitudes = []
        for _, row in daily_stats.iterrows():
            amplitudes.append({
                "data": row['date'].isoformat(),
                "temp_minima": round(float(row['min']), 2),
                "temp_maxima": round(float(row['max']), 2),
                "amplitude": round(float(row['amplitude']), 2)
            })
        
        amplitude_media = daily_stats['amplitude'].mean()
        
        # Análise
        if amplitude_media > 10:
            estabilidade = "baixa"
            alerta = "Alta variação térmica - pode afetar qualidade"
        elif amplitude_media > 5:
            estabilidade = "moderada"
            alerta = "Variação normal - monitorar"
        else:
            estabilidade = "alta"
            alerta = "Ótima estabilidade térmica"
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "amplitude_media": round(amplitude_media, 2),
            "amplitude_maxima": round(float(daily_stats['amplitude'].max()), 2),
            "amplitude_minima": round(float(daily_stats['amplitude'].min()), 2),
            "estabilidade": estabilidade,
            "alerta": alerta,
            "historico_diario": amplitudes
        }
    
    async def get_humidity_rate(self, device_id: str, days: int = 7) -> Dict:
        """
        Taxa de Aumento de Umidade (ΔU/Δt)
        Mudança percentual por hora/dia
        """
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data or len(data) < 10:
            return {"erro": "Dados insuficientes"}
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Calcular variação por hora
        df['umidade_diff'] = df['umidade'].diff()
        df['time_diff_hours'] = df['timestamp'].diff().dt.total_seconds() / 3600
        
        # FILTRAR: Ignorar intervalos muito curtos (menores que 5 minutos)
        # Isso evita divisões por valores muito pequenos que geram taxas absurdas
        df = df[df['time_diff_hours'] >= 0.083]  # 5 minutos = 0.083 horas
        
        # Calcular taxa apenas para intervalos válidos
        df['taxa_por_hora'] = df['umidade_diff'] / df['time_diff_hours']
        
        # FILTRAR: Remover outliers absurdos (taxas maiores que 50%/hora são irreais)
        # Em condições normais, umidade não varia mais que isso por hora
        df = df[abs(df['taxa_por_hora']) <= 50]
        
        # Filtrar valores válidos
        df_valid = df[df['taxa_por_hora'].notna()]
        
        if len(df_valid) == 0:
            return {"erro": "Não foi possível calcular taxas válidas"}
        
        taxa_media = df_valid['taxa_por_hora'].mean()
        taxa_maxima = df_valid['taxa_por_hora'].max()
        taxa_minima = df_valid['taxa_por_hora'].min()
        
        # Usar valor absoluto médio para análise de risco
        # Isso considera tanto aumentos quanto diminuições
        taxa_abs_media = df_valid['taxa_por_hora'].abs().mean()
        
        # Determinar tendência dominante
        if taxa_media > 0:
            tendencia = "aumentando"
        elif taxa_media < 0:
            tendencia = "diminuindo"
        else:
            tendencia = "estável"
        
        # Análise baseada em taxa absoluta
        if taxa_abs_media > 2:
            risco = "alto"
            alerta = "Taxa de variação crítica - verificar vedação"
        elif taxa_abs_media > 1:
            risco = "moderado"
            alerta = "Taxa elevada - monitorar infiltração"
        else:
            risco = "baixo"
            alerta = "Taxa normal de variação"
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "taxa_media_por_hora": round(taxa_media, 3),
            "taxa_maxima_aumento_por_hora": round(float(taxa_maxima), 3),
            "taxa_maxima_diminuicao_por_hora": round(float(taxa_minima), 3),
            "taxa_media_por_dia": round(taxa_media * 24, 2),
            "taxa_abs_media": round(taxa_abs_media, 3),
            "tendencia": tendencia,
            "risco": risco,
            "alerta": alerta,
            "total_leituras_analisadas": len(df_valid)
        }
    
    async def get_fungus_risk_index(self, device_id: str, days: int = 7) -> Dict:
        """
        Índice de Risco de Fungos (IRF)
        Função de T e UR alta (>30°C e >75%)
        """
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data:
            return {"erro": "Sem dados"}
        
        df = pd.DataFrame(data)
        
        # Calcular IRF
        # IRF = 0 se condições normais, até 100 se condições críticas
        df['irf'] = 0
        
        # Temperatura > 30°C contribui com até 50 pontos
        temp_risk = ((df['temperatura'] - 30) / 10).clip(0, 1) * 50
        
        # Umidade > 75% contribui com até 50 pontos
        umid_risk = ((df['umidade'] - 75) / 25).clip(0, 1) * 50
        
        df['irf'] = temp_risk + umid_risk
        df['irf'] = df['irf'].clip(0, 100)
        
        # Contar horas em cada nível de risco
        horas_criticas = len(df[df['irf'] > 70])
        horas_alerta = len(df[(df['irf'] > 40) & (df['irf'] <= 70)])
        horas_normais = len(df[df['irf'] <= 40])
        
        irf_medio = df['irf'].mean()
        
        # Classificação
        if irf_medio > 70:
            nivel = "crítico"
            recomendacao = "Ação urgente: ventilação e controle de umidade"
        elif irf_medio > 40:
            nivel = "alerta"
            recomendacao = "Monitorar de perto e melhorar ventilação"
        else:
            nivel = "normal"
            recomendacao = "Condições adequadas"
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "irf_medio": round(irf_medio, 2),
            "irf_maximo": round(float(df['irf'].max()), 2),
            "nivel_risco": nivel,
            "horas_criticas": horas_criticas,
            "horas_alerta": horas_alerta,
            "horas_normais": horas_normais,
            "percentual_critico": round((horas_criticas / len(df)) * 100, 2),
            "recomendacao": recomendacao
        }
    
    async def get_critical_time_above_limit(self, device_id: str, days: int = 7) -> Dict:
        """
        Horas Acima de Limite Crítico (TAC)
        Tempo acumulado com T>35°C
        """
        data = await self.repository.get_last_hours(device_id, days * 24)
        
        if not data:
            return {"erro": "Sem dados"}
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Identificar períodos críticos
        df['critico'] = df['temperatura'] > 35
        
        # Calcular tempo em condição crítica
        horas_criticas = df['critico'].sum()
        total_horas = len(df)
        percentual_critico = (horas_criticas / total_horas) * 100 if total_horas > 0 else 0
        
        # Encontrar períodos contínuos críticos
        df['grupo_critico'] = (df['critico'] != df['critico'].shift()).cumsum()
        periodos_criticos = []
        
        for grupo_id, grupo_df in df[df['critico']].groupby('grupo_critico'):
            if len(grupo_df) > 0:
                periodos_criticos.append({
                    "inicio": grupo_df['timestamp'].min().isoformat(),
                    "fim": grupo_df['timestamp'].max().isoformat(),
                    "duracao_horas": len(grupo_df),
                    "temp_maxima": round(float(grupo_df['temperatura'].max()), 2)
                })
        
        # Ordenar por duração (mais longos primeiro)
        periodos_criticos = sorted(periodos_criticos, key=lambda x: x['duracao_horas'], reverse=True)
        
        # Análise de risco
        if horas_criticas > 6:
            risco = "alto"
            acao = "Ação urgente necessária"
        elif horas_criticas > 3:
            risco = "moderado"
            acao = "Monitorar e preparar ação"
        else:
            risco = "baixo"
            acao = "Situação sob controle"
        
        return {
            "dispositivo": device_id,
            "periodo_dias": days,
            "horas_acima_35c": int(horas_criticas),
            "total_horas_analisadas": int(total_horas),
            "percentual_critico": round(percentual_critico, 2),
            "temperatura_maxima_registrada": round(float(df['temperatura'].max()), 2),
            "nivel_risco": risco,
            "acao_recomendada": acao,
            "periodos_criticos": periodos_criticos[:5]  # Top 5 mais longos
        }