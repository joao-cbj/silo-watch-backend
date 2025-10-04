import Dados from "../models/Dados.js";

export class DadosRepository {
  async criar(dados) {
    return await Dados.create(dados);
  }

  async listar(filtros, limite = 50) {
    return await Dados.find(filtros).sort({ timestamp: -1 }).limit(limite).lean();
  }

  async contar(filtros) {
    return await Dados.countDocuments(filtros);
  }
}
