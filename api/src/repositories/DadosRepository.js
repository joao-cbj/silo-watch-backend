import Dados from "../models/Dados.js";

export class DadosRepository {
  async criar(leituraESP32) {
    return await Dados.create(leituraESP32);
  }

  async listar(filtros, limite = 50) {
    return await Dados.find(filtros).sort({ timestamp: -1 }).limit(limite).lean();
  }

  async contar(filtros) {
    return await Dados.countDocuments(filtros);
  }

  // Histórico de um dispositivo
  async buscarHistorico(dispositivoId, dataLimite) {
    return await Dados.find({
      dispositivo: dispositivoId,
      timestamp: { $gte: dataLimite }
    })
    .sort({ timestamp: 1 }) // Ordem crescente para gráficos
    .lean();
  }

  // Última leitura de cada dispositivo (agregação)
  async buscarUltimasLeituras() {
    return await Dados.aggregate([
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: "$dispositivo",
          ultimaLeitura: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$ultimaLeitura" }
      }
    ]);
  }


  async buscarHistoricoPorIntervalo(dispositivoId, dataInicio, dataFim) {
    return await Dados.find({
      dispositivo: dispositivoId,
      timestamp: {
        $gte: dataInicio,
        $lte: dataFim
      }
    }).sort({ timestamp: 1 }).lean();
  }

}