import { SiloRepository } from "../repositories/SiloRepository.js";

export class SiloService {
  constructor() {
    this.repository = new SiloRepository();
  }

  async criar(dados) {
    // Validações
    if (!dados.nome || !dados.tipoSilo) {
      throw new Error("Nome e tipo do silo são obrigatórios");
    }

    return await this.repository.criar(dados);
  }

  async listarTodos(filtros = {}) {
    const silos = await this.repository.listarTodos(filtros);
    const total = await this.repository.contar(filtros);
    return { silos, total };
  }

  async buscarPorId(id) {
    const silo = await this.repository.buscarPorId(id);
    if (!silo) {
      throw new Error("Silo não encontrado");
    }
    return silo;
  }

  async atualizar(id, dados) {
    // Verifica se o silo existe
    await this.buscarPorId(id);

    // Se está integrando um dispositivo, verifica se já não está em uso
    if (dados.dispositivo) {
      const existe = await this.repository.verificarDispositivoExiste(
        dados.dispositivo, 
        id
      );
      if (existe) {
        throw new Error(`Dispositivo ${dados.dispositivo} já está integrado a outro silo`);
      }
    }

    return await this.repository.atualizar(id, dados);
  }

  async deletar(id) {
    // Verifica se o silo existe
    await this.buscarPorId(id);
    
    return await this.repository.deletar(id);
  }

  async buscarPorDispositivo(dispositivo) {
    return await this.repository.buscarPorDispositivo(dispositivo);
  }
}