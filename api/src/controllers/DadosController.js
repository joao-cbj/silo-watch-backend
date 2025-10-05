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

  // NOVO - Para os GRÁFICOS - histórico de um dispositivo específico
  static async listarPorDispositivo(req, res) {
    try {
      const { dispositivoId } = req.params;
      const { horas = 24 } = req.query;
      
      const historico = await service.buscarHistorico(dispositivoId, parseInt(horas));
      
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