import Silo from "../models/Silo.js";

export class SiloRepository {
  async criar(dados) {
    return await Silo.create(dados);
  }

  async listarTodos(filtros = {}) {
    return await Silo.find(filtros).sort({ criadoEm: -1 }).lean();
  }

  async buscarPorId(id) {
    return await Silo.findById(id).lean();
  }

  async buscarPorDispositivo(dispositivo) {
    return await Silo.findOne({ dispositivo }).lean();
  }

  async atualizar(id, dados) {
    dados.atualizadoEm = new Date();
    return await Silo.findByIdAndUpdate(id, dados, { 
      new: true, 
      runValidators: true 
    }).lean();
  }

  async deletar(id) {
    return await Silo.findByIdAndDelete(id);
  }

  async contar(filtros = {}) {
    return await Silo.countDocuments(filtros);
  }

  async verificarDispositivoExiste(dispositivo, excluirId = null) {
    const query = { dispositivo };
    if (excluirId) {
      query._id = { $ne: excluirId };
    }
    return await Silo.exists(query);
  }
}