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
      console.error('Erro ao criar silo:', err);
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
      console.error('Erro ao listar silos:', err);
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
      console.error('Erro ao buscar silo:', err);
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
      const { nome, tipoSilo } = req.body;
      
      console.log(`\n=== ATUALIZAR SILO ===`);
      console.log(`ID: ${id}`);
      console.log(`Novo nome: ${nome}`);
      
      const siloAtual = await service.buscarPorId(id);
      console.log(`Silo atual: ${siloAtual.nome}`);
      
      const nomeAlterado = nome && nome.trim() !== siloAtual.nome;
      
      const silo = await service.atualizar(id, req.body);
      console.log(`✓ Silo atualizado no banco`);
      
      
      res.status(200).json({ 
        success: true, 
        message: "Silo atualizado com sucesso", 
        data: silo 
      });
      
    } catch (err) {
      console.error('Erro ao atualizar silo:', err);
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
      
      console.log(`\n=== DELETAR SILO ===`);
      console.log(`ID: ${id}`);
      
      const silo = await service.buscarPorId(id);
      console.log(`Silo: ${silo.nome}`);
      console.log(`Dispositivo: ${silo.dispositivo}`);
      console.log(`Integrado: ${silo.integrado}`);
      
      // Deleta dados históricos
      let dadosDeletados = 0;
      if (silo.dispositivo) {
        try {
          const resultado = await Dados.deleteMany({ 
            dispositivo: silo.dispositivo 
          });
          dadosDeletados = resultado.deletedCount;
          console.log(`✓ ${dadosDeletados} leituras deletadas`);
        } catch (dadosError) {
          console.error('✗ Erro ao deletar dados:', dadosError);
        }
      }
      
      // Deleta o silo
      await service.deletar(id);
      console.log(`✓ Silo deletado do banco`);
      
      const mensagem = silo.integrado 
        ? "Silo deletado. Pressione o botão do ESP32 por 3 segundos para resetar a memória."
        : "Silo deletado.";
      
      res.status(200).json({ 
        success: true, 
        message: mensagem,
        dadosDeletados: dadosDeletados
      });
    } catch (err) {
      console.error('Erro ao deletar silo:', err);
      const status = err.message === "Silo não encontrado" ? 404 : 500;
      res.status(status).json({ 
        success: false, 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
          integrado: silo.integrado,
          macAddress: silo.macAddress
        }
      });
    } catch (err) {
      console.error('Erro ao buscar configuração:', err);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  // Estatísticas
  static async estatisticas(req, res) {
    try {
      const stats = await service.obterEstatisticas();
      res.status(200).json({ 
        success: true, 
        data: stats 
      });
    } catch (err) {
      console.error('Erro ao obter estatísticas:', err);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }
}