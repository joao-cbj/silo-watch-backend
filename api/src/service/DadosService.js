import { DadosRepository } from "../repositories/DadosRepository.js";

export class DadosService {
  constructor() {
    this.repo = new DadosRepository();
  }

  async salvar(dados) {
    // Limpeza e tratamento dos dados
    const temperatura = parseFloat(dados.temperatura);
    const umidade = parseFloat(dados.umidade);
    const dispositivo = String(dados.dispositivo).trim().toUpperCase();

    if (isNaN(temperatura) || isNaN(umidade) || !dispositivo) {
      throw new Error("Dados inválidos");
    }

    return await this.repo.criar({ temperatura, umidade, dispositivo });
  }

  async buscar(filtros, limite) {
    return {
      total: await this.repo.contar(filtros),
      dados: await this.repo.listar(filtros, limite)
    };
  }
}
