import { DadosRepository } from "../repositories/DadosRepository.js";

export class DadosService {
  constructor() {
    this.repository = new DadosRepository();
  }

  async salvar(leituraESP32) {
    if (!leituraESP32.temperatura || !leituraESP32.umidade || !leituraESP32.dispositivo) {
      throw new Error("Temperatura, umidade e dispositivo são obrigatórios");
    }
    return await this.repository.criar(leituraESP32);
  }

  async buscar(filtros, limite = 50) {
    const dados = await this.repository.listar(filtros, limite);
    const total = await this.repository.contar(filtros);
    return { dados, total };
  }

  // NOVO - Histórico de um dispositivo específico
  async buscarHistorico(dispositivoId, horas = 24) {
    const dataLimite = new Date();
    dataLimite.setHours(dataLimite.getHours() - horas);

    return await this.repository.buscarHistorico(dispositivoId, dataLimite);
  }

  // NOVO - Última leitura de cada dispositivo
  async buscarUltimasLeituras() {
    return await this.repository.buscarUltimasLeituras();
  }
}