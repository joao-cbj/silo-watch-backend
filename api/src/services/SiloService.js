import { SiloRepository } from "../repositories/SiloRepository.js";

const repository = new SiloRepository();

export class SiloService {
  async criar(dados) {
    const { nome, tipoSilo, dispositivo } = dados;

    if (dispositivo) {
      const existe = await repository.verificarDispositivoExiste(dispositivo);
      if (existe) {
        throw new Error("Dispositivo já está vinculado a outro silo");
      }
    }

    return await repository.criar({
      nome: nome.trim(),
      tipoSilo,
      dispositivo: dispositivo?.trim(),
      integrado: !!dispositivo
    });
  }

  async listarTodos(filtros = {}) {
    const silos = await repository.listarTodos(filtros);
    const total = await repository.contar(filtros);
    
    return {
      silos,
      total,
      integrados: silos.filter(s => s.integrado).length,
      naoIntegrados: silos.filter(s => !s.integrado).length
    };
  }

  async buscarPorId(id) {
    const silo = await repository.buscarPorId(id);
    if (!silo) {
      throw new Error("Silo não encontrado");
    }
    return silo;
  }

  async buscarPorDispositivo(dispositivo) {
    const silo = await repository.buscarPorDispositivo(dispositivo);
    if (!silo) {
      throw new Error("Silo não encontrado");
    }
    return silo;
  }

  async atualizar(id, dados) {
    const siloExistente = await this.buscarPorId(id);

    if (dados.dispositivo && dados.dispositivo !== siloExistente.dispositivo) {
      const existe = await repository.verificarDispositivoExiste(dados.dispositivo, id);
      if (existe) {
        throw new Error("Dispositivo já está vinculado a outro silo");
      }
    }

    const dadosAtualizados = {};
    if (dados.nome) dadosAtualizados.nome = dados.nome.trim();
    if (dados.tipoSilo) dadosAtualizados.tipoSilo = dados.tipoSilo;
    if (dados.dispositivo !== undefined) {
      dadosAtualizados.dispositivo = dados.dispositivo?.trim();
      dadosAtualizados.integrado = !!dados.dispositivo;
    }

    return await repository.atualizar(id, dadosAtualizados);
  }

  async deletar(id) {
    const silo = await this.buscarPorId(id);
    await repository.deletar(id);
    return silo;
  }

  // Retorna estatísticas dos silos
  async obterEstatisticas() {
    const total = await repository.contar();
    const ativos = await repository.contar({ integrado: true });
    const inativos = await repository.contar({ integrado: false });

    return {
      total,
      ativos,
      inativos,
      porcentagemAtivos: total > 0 ? ((ativos / total) * 100).toFixed(1) : 0
    };
  }
}