import numpy as np
from typing import List, Dict, Tuple
from scipy import signal
import pandas as pd

class StatsUtils:
    """Utilitários para análises estatísticas avançadas"""
    
    @staticmethod
    def moving_average(data: List[float], window: int = 5) -> List[float]:
        """Calcular média móvel"""
        if len(data) < window:
            return data
        
        return np.convolve(data, np.ones(window)/window, mode='valid').tolist()
    
    @staticmethod
    def detect_peaks(data: List[float], prominence: float = 1.0) -> Dict:
        """Detectar picos nos dados"""
        peaks, properties = signal.find_peaks(data, prominence=prominence)
        troughs, _ = signal.find_peaks([-x for x in data], prominence=prominence)
        
        return {
            "picos_maximos": peaks.tolist(),
            "picos_minimos": troughs.tolist(),
            "total_picos": len(peaks),
            "total_vales": len(troughs)
        }
    
    @staticmethod
    def calculate_variability(data: List[float]) -> Dict:
        """Calcular métricas de variabilidade"""
        arr = np.array(data)
        
        return {
            "variancia": float(np.var(arr)),
            "desvio_padrao": float(np.std(arr)),
            "coeficiente_variacao": float(np.std(arr) / np.mean(arr) * 100) if np.mean(arr) != 0 else 0,
            "amplitude": float(np.ptp(arr)),
            "intervalo_interquartil": float(np.percentile(arr, 75) - np.percentile(arr, 25))
        }
    
    @staticmethod
    def exponential_smoothing(data: List[float], alpha: float = 0.3) -> List[float]:
        """Suavização exponencial"""
        if not data:
            return []
        
        smoothed = [data[0]]
        for value in data[1:]:
            smoothed.append(alpha * value + (1 - alpha) * smoothed[-1])
        
        return smoothed
    
    @staticmethod
    def calculate_rate_of_change(data: List[float], timestamps: List) -> Dict:
        """Calcular taxa de mudança"""
        if len(data) < 2:
            return {"erro": "Dados insuficientes"}
        
        changes = np.diff(data)
        time_diffs = np.diff([t.timestamp() for t in timestamps]) / 3600  # em horas
        
        rates = changes / time_diffs
        
        return {
            "taxa_media": float(np.mean(rates)),
            "taxa_maxima": float(np.max(rates)),
            "taxa_minima": float(np.min(rates)),
            "taxa_desvio_padrao": float(np.std(rates))
        }
    
    @staticmethod
    def detect_outliers_iqr(data: List[float]) -> Dict:
        """Detectar outliers usando método IQR"""
        arr = np.array(data)
        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers_indices = np.where((arr < lower_bound) | (arr > upper_bound))[0]
        
        return {
            "limite_inferior": float(lower_bound),
            "limite_superior": float(upper_bound),
            "indices_outliers": outliers_indices.tolist(),
            "total_outliers": len(outliers_indices),
            "valores_outliers": arr[outliers_indices].tolist() if len(outliers_indices) > 0 else []
        }
    
    @staticmethod
    def time_series_decomposition(df: pd.DataFrame, column: str, period: int = 24) -> Dict:
        """Decompor série temporal em tendência, sazonalidade e resíduo"""
        try:
            from statsmodels.tsa.seasonal import seasonal_decompose
            
            if len(df) < period * 2:
                return {"erro": "Dados insuficientes para decomposição"}
            
            decomposition = seasonal_decompose(
                df[column],
                model='additive',
                period=period,
                extrapolate_trend='freq'
            )
            
            return {
                "tendencia_media": float(decomposition.trend.mean()),
                "sazonalidade_amplitude": float(decomposition.seasonal.max() - decomposition.seasonal.min()),
                "residuo_std": float(decomposition.resid.std())
            }
        except Exception as e:
            return {"erro": f"Erro na decomposição: {str(e)}"}
    
    @staticmethod
    def calculate_entropy(data: List[float], bins: int = 10) -> float:
        """Calcular entropia dos dados"""
        hist, _ = np.histogram(data, bins=bins, density=True)
        hist = hist[hist > 0]  # Remove zeros
        entropy = -np.sum(hist * np.log2(hist))
        return float(entropy)
    
    @staticmethod
    def autocorrelation(data: List[float], lag: int = 1) -> float:
        """Calcular autocorrelação com lag específico"""
        arr = np.array(data)
        if len(arr) <= lag:
            return 0.0
        
        mean = np.mean(arr)
        c0 = np.sum((arr - mean) ** 2)
        c_lag = np.sum((arr[:-lag] - mean) * (arr[lag:] - mean))
        
        return float(c_lag / c0) if c0 != 0 else 0.0