import { SiloService } from "../services/SiloService.js";
import Dados from "../models/Dados.js";

const service = new SiloService();

export class SiloController {
  static async criar(req, res) {
    try {
      const silo = await service.criar(req.body);
      res.status(201).json({ 
        success: true, 
        message: "Silo cadastrado com sucesso", 
        data: silo 
      });
    } catch (err) {
      res.status(400).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  static async listar(req, res) {
    try {
      const { tipoSilo, integrado } = req.query;
      const filtros = {};
      
      if (tipoSilo) filtros.tipoSilo = tipoSilo;
      if (integrado !== undefined) filtros.integrado = integrado === 'true';
      
      const resultado = await service.listarTodos(filtros);
      res.status(200).json({ 
        success: true, 
        ...resultado 
      });
    } catch (err) {
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  static async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const silo = await service.buscarPorId(id);

      res.status(200).json({ 
        success: true, 
        data: silo 
      });
    } catch (err) {
      const status = err.message === "Silo não encontrado" ? 404 : 500;
      res.status(status).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const silo = await service.atualizar(id, req.body);
      res.status(200).json({ 
        success: true, 
        message: "Silo atualizado com sucesso", 
        data: silo 
      });
    } catch (err) {
      const status = err.message === "Silo não encontrado" ? 404 : 400;
      res.status(status).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  // ATUALIZADO: Deleta silo E seus dados
  static async deletar(req, res) {
    try {
      const { id } = req.params;
      
      // Busca o silo primeiro para pegar o dispositivo
      const silo = await service.buscarPorId(id);
      
      // Deleta o silo
      await service.deletar(id);
      
      // Se tinha dispositivo integrado, deleta os dados também
      let dadosDeletados = 0;
      if (silo.dispositivo && silo.integrado) {
        const resultado = await Dados.deleteMany({ 
          dispositivo: silo.dispositivo 
        });
        dadosDeletados = resultado.deletedCount;
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Silo deletado com sucesso",
        dadosDeletados: dadosDeletados
      });
    } catch (err) {
      const status = err.message === "Silo não encontrado" ? 404 : 500;
      res.status(status).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  // Endpoint para o ESP32/Gateway consultar configurações
  static async buscarConfiguracao(req, res) {
    try {
      const { dispositivo } = req.params;
      const silo = await service.buscarPorDispositivo(dispositivo);
      
      if (!silo) {
        return res.status(404).json({
          success: false,
          error: "Silo não encontrado"
        });
      }

      res.status(200).json({ 
        success: true, 
        data: {
          nome: silo.nome,
          dispositivo: silo.dispositivo,
          integrado: silo.integrado
        }
      });
    } catch (err) {
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  // Novo endpoint para estatísticas
  static async estatisticas(req, res) {
    try {
      const stats = await service.obterEstatisticas();
      res.status(200).json({ 
        success: true, 
        data: stats 
      });
    } catch (err) {
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }
}