import { SiloService } from "../services/SiloService.js";
import Dados from "../models/Dados.js";
import mqtt from 'mqtt';

const service = new SiloService();

// Conexão MQTT para enviar comandos
const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;

let mqttClient = null;

function getMQTTClient() {
  if (!mqttClient || !mqttClient.connected) {
    mqttClient = mqtt.connect(MQTT_BROKER, {
      username: MQTT_USER,
      password: MQTT_PASS,
      clientId: `backend_silo_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000
    });
  }
  return mqttClient;
}

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

  // ✨ ATUALIZADO: Atualiza silo + envia comando para ESP32 + atualiza dados históricos
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, tipoSilo } = req.body;
      
      // Busca o silo atual
      const siloAtual = await service.buscarPorId(id);
      
      // Verifica se houve mudança no nome
      const nomeAlterado = nome && nome !== siloAtual.nome;
      
      // Atualiza o silo no banco
      const silo = await service.atualizar(id, req.body);
      
      // Se nome foi alterado E silo está integrado
      if (nomeAlterado && siloAtual.integrado && siloAtual.dispositivo) {
        
        // 1️⃣ Atualiza todos os dados históricos
        const novoDispositivo = nome.replace(/\s+/g, '_');
        const resultadoDados = await Dados.updateMany(
          { dispositivo: siloAtual.dispositivo },
          { $set: { dispositivo: novoDispositivo } }
        );
        
        console.log(`✓ ${resultadoDados.modifiedCount} leituras atualizadas`);
        
        // 2️⃣ Envia comando via MQTT para Gateway
        const client = getMQTTClient();
        
        if (client.connected) {
          client.publish('gateway/comando', JSON.stringify({
            acao: 'atualizar_nome',
            id: `update_${Date.now()}`,
            dispositivo: siloAtual.dispositivo,
            novoNome: nome.trim(),
            timestamp: Date.now()
          }));
          
          console.log(`✓ Comando atualizar_nome enviado: ${siloAtual.dispositivo} → ${nome}`);
        }
        
        res.status(200).json({ 
          success: true, 
          message: "Silo e dados atualizados. Comando enviado ao ESP32.", 
          data: silo,
          dadosAtualizados: resultadoDados.modifiedCount
        });
      } else {
        res.status(200).json({ 
          success: true, 
          message: "Silo atualizado com sucesso", 
          data: silo 
        });
      }
    } catch (err) {
      const status = err.message === "Silo não encontrado" ? 404 : 400;
      res.status(status).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  // ✨ ATUALIZADO: Deleta silo + dados + envia comando reset para ESP32
  static async deletar(req, res) {
    try {
      const { id } = req.params;
      
      // Busca o silo primeiro
      const silo = await service.buscarPorId(id);
      
      // Se silo está integrado, envia comando de reset
      if (silo.integrado && silo.dispositivo) {
        const client = getMQTTClient();
        
        if (client.connected) {
          client.publish('gateway/comando', JSON.stringify({
            acao: 'desintegrar',
            id: `delete_${Date.now()}`,
            dispositivo: silo.dispositivo,
            timestamp: Date.now()
          }));
          
          console.log(`✓ Comando desintegrar enviado ao deletar: ${silo.dispositivo}`);
        }
      }
      
      // Deleta dados históricos
      let dadosDeletados = 0;
      if (silo.dispositivo) {
        const resultado = await Dados.deleteMany({ 
          dispositivo: silo.dispositivo 
        });
        dadosDeletados = resultado.deletedCount;
      }
      
      // Deleta o silo
      await service.deletar(id);
      
      res.status(200).json({ 
        success: true, 
        message: "Silo deletado. Comando de reset enviado ao ESP32.",
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

  // Estatísticas
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