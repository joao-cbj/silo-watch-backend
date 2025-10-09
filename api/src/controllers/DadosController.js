import { DadosService } from "../services/DadosService.js";
import { Parser } from "json2csv";

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

  // Histórico de um dispositivo específico com intervalo de datas
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
        dados: historico,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Última leitura de cada dispositivo (para dashboard)
  static async ultimasLeituras(req, res) {
    try {
      const leituras = await service.buscarUltimasLeituras();
      res.status(200).json({ success: true, data: leituras });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Exportar dados para CSV
  static async exportar(req, res) {
    try {
      const { dispositivo, inicio, fim, limite } = req.query;
      const filtros = {};

      // Filtros opcionais
      if (dispositivo) filtros.dispositivo = dispositivo;
      if (inicio && fim) {
        filtros.timestamp = {
          $gte: new Date(inicio),
          $lte: new Date(fim),
        };
      }

      // Busca todos os dados (ou limitados)
      const { dados } = await service.buscar(filtros, parseInt(limite) || 10000);

      if (!dados.length) {
        return res.status(404).json({
          success: false,
          message: "Nenhum dado encontrado para exportação.",
        });
      }

      // Geração do CSV
      const fields = ["timestamp", "temperatura", "umidade", "dispositivo"];
      const parser = new Parser({ fields });
      const csv = parser.parse(dados);

      // Envio do arquivo
      res.header("Content-Type", "text/csv");
      res.attachment(
        `relatorio_${dispositivo || "todos"}_${inicio || "inicio"}_${fim || "fim"}.csv`
      );
      return res.send(csv);
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
      return res
        .status(500)
        .json({ success: false, message: "Erro ao gerar CSV." });
    }
  }
}
