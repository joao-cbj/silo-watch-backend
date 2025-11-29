import { DadosService } from "../services/DadosService.js";
import { Parser } from "json2csv";
import Dados from "../models/Dados.js";
import Silo from "../models/Silo.js";

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

  // ultima leitura de cada dispositivo
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

  // Agora faz join usando _id do Silo (armazenado em dispositivo)
  static async ultimasLeituras(req, res) {
    try {
      // Agrupa os dados por dispositivo (_id do silo) e pega o mais recente
      const ultimasDados = await Dados.aggregate([
        {
          $sort: { timestamp: -1 }
        },
        {
          $group: {
            _id: "$dispositivo",
            temperatura: { $first: "$temperatura" },
            umidade: { $first: "$umidade" },
            timestamp: { $first: "$timestamp" }
          }
        }
      ]);

      // Busca informações dos silos integrados
      const silosIntegrados = await Silo.find({ integrado: true }).lean();

      // Faz o "INNER JOIN" manual - apenas silos com dados E cadastrados
      // MUDANÇA: Agora faz match pelo _id do silo
      const dadosComSilo = ultimasDados
        .map(dado => {
          const silo = silosIntegrados.find(s => s._id.toString() === dado._id);
          
          // INNER JOIN: só retorna se o silo existir
          if (!silo) return null;
          
          return {
            _id: silo._id,
            dispositivo: silo._id.toString(), // O dispositivo agora é o _id
            nome: silo.nome,
            tipoSilo: silo.tipoSilo,
            temperatura: dado.temperatura,
            umidade: dado.umidade,
            timestamp: dado.timestamp,
            integrado: true,
            macAddress: silo.macAddress
          };
        })
        .filter(item => item !== null); // Remove itens sem silo correspondente

      res.status(200).json({
        success: true,
        data: dadosComSilo,
        total: dadosComSilo.length
      });
    } catch (error) {
      console.error("Erro ao buscar últimas leituras:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao buscar dados"
      });
    }
  }

  // Busca histórico de um dispositivo específico (método alternativo)
  static async buscarHistorico(req, res) {
    try {
      const { dispositivo } = req.params;
      const { limit = 100, hours = 24 } = req.query;

      const horasAtras = new Date(Date.now() - hours * 60 * 60 * 1000);

      const dados = await Dados.find({
        dispositivo,
        timestamp: { $gte: horasAtras }
      })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();

      res.status(200).json({
        success: true,
        data: dados,
        total: dados.length
      });
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao buscar histórico"
      });
    }
  }

  // Deleta dados de um silo específico
  static async deletarPorDispositivo(req, res) {
    try {
      const { dispositivo } = req.params;

      const resultado = await Dados.deleteMany({ dispositivo });

      res.status(200).json({
        success: true,
        message: `${resultado.deletedCount} leituras deletadas`,
        deletedCount: resultado.deletedCount
      });
    } catch (error) {
      console.error("Erro ao deletar dados:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao deletar dados"
      });
    }
  }
}