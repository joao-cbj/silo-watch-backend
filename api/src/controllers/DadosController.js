import { DadosService } from "../services/DadosService.js";

const service = new DadosService();

export class DadosController {
  static async criar(req, res) {
    try {
      const dados = await service.salvar(req.body);
      res.status(201).json({ success: true, message: "Dados salvos", id: dados._id });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // Para o DASHBOARD - última leitura de cada dispositivo
  static async listar(req, res) {
    try {
      const { limite = 50, dispositivo } = req.query;
      const filtros = dispositivo ? { dispositivo } : {};
      const resultado = await service.buscar(filtros, parseInt(limite));
      res.status(200).json({ success: true, ...resultado });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

// NOVO - Histórico de um dispositivo específico com intervalo de datas
static async listarPorDispositivo(req, res) {
  try {
    const { dispositivoId } = req.params;
    const { inicio, fim, horas } = req.query;

    let historico = [];

    if (inicio && fim) {
      const dataInicio = new Date(inicio);
      const dataFim = new Date(fim);
      historico = await service.buscarHistoricoPorIntervalo(dispositivoId, dataInicio, dataFim);
    } else if (horas) {
      historico = await service.buscarHistorico(dispositivoId, parseInt(horas));
    } else {
      // Padrão: últimas 24 horas
      historico = await service.buscarHistorico(dispositivoId, 24);
    }

    res.status(200).json({
      success: true,
      dispositivo: dispositivoId,
      dados: historico
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

  // NOVO - Última leitura de cada dispositivo (otimizado para dashboard)
  static async ultimasLeituras(req, res) {
    try {
      const leituras = await service.buscarUltimasLeituras();
      res.status(200).json({ success: true, data: leituras });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}