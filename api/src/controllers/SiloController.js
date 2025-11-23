import { SiloService } from "../services/SiloService.js";

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

  static async deletar(req, res) {
    try {
      const { id } = req.params;
      await service.deletar(id);
      res.status(200).json({ 
        success: true, 
        message: "Silo deletado com sucesso" 
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

      // Retorna apenas dados necessários para o ESP
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
}