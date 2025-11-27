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

    mqttClient.on('connect', () => {
      console.log('✓ MQTT Client conectado');
    });

    mqttClient.on('error', (err) => {
      console.error('✗ MQTT Client erro:', err);
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

  // Atualiza silo + envia comando via MAC Address
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, tipoSilo } = req.body;
      
      console.log(`\n=== ATUALIZAR SILO ===`);
      console.log(`ID: ${id}`);
      console.log(`Novo nome: ${nome}`);
      
      const siloAtual = await service.buscarPorId(id);
      console.log(`Silo atual: ${siloAtual.nome}`);
      console.log(`MAC: ${siloAtual.macAddress}`);
      
      const nomeAlterado = nome && nome.trim() !== siloAtual.nome;
      
      const silo = await service.atualizar(id, req.body);
      console.log(`✓ Silo atualizado no banco`);
      
      // Se nome foi alterado E silo está integrado
      if (nomeAlterado && siloAtual.integrado && siloAtual.dispositivo) {
        console.log(`✓ Nome alterado - sincronizando...`);
        
        // 1️⃣ Atualiza dados históricos
        const novoDispositivo = nome.trim();
        const resultadoDados = await Dados.updateMany(
          { dispositivo: siloAtual.dispositivo },
          { $set: { dispositivo: novoDispositivo } }
        );
        
        console.log(`✓ ${resultadoDados.modifiedCount} leituras atualizadas`);
        
        // 2️⃣ Envia comando via MQTT usando MAC Address
        if (siloAtual.macAddress) {
          const client = getMQTTClient();
          
          if (client.connected) {
            const comando = {
              acao: 'atualizar_nome',
              id: `update_${Date.now()}`,
              macSilo: siloAtual.macAddress,  
              dispositivo: siloAtual.dispositivo,
              novoNome: nome.trim(),
              timestamp: Date.now()
            };
            
            console.log('Comando MQTT:', JSON.stringify(comando, null, 2));
            client.publish('gateway/comando', JSON.stringify(comando));
            
            console.log(`✓ Comando enviado para MAC: ${siloAtual.macAddress}`);
            
            res.status(200).json({ 
              success: true, 
              message: "Silo e dados atualizados. Comando enviado ao ESP32.", 
              data: silo,
              dadosAtualizados: resultadoDados.modifiedCount,
              mqttEnviado: true
            });
          } else {
            console.warn('MQTT offline');
            res.status(200).json({ 
              success: true, 
              message: "Silo atualizado no banco. MQTT offline.", 
              data: silo,
              dadosAtualizados: resultadoDados.modifiedCount,
              mqttEnviado: false
            });
          }
        } else {
          console.warn('MAC Address não encontrado');
          res.status(200).json({ 
            success: true, 
            message: "Silo atualizado no banco. MAC não encontrado.", 
            data: silo,
            dadosAtualizados: resultadoDados.modifiedCount,
            mqttEnviado: false
          });
        }
      } else {
        res.status(200).json({ 
          success: true, 
          message: "Silo atualizado com sucesso", 
          data: silo 
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar silo:', err);
      const status = err.message === "Silo não encontrado" ? 404 : 400;
      res.status(status).json({ 
        success: false, 
        error: err.message 
      });
    }
  }

  // Deleta silo + envia comando via MAC Address
  static async deletar(req, res) {
    try {
      const { id } = req.params;
      
      console.log(`\n=== DELETAR SILO ===`);
      console.log(`ID: ${id}`);
      
      const silo = await service.buscarPorId(id);
      console.log(`Silo: ${silo.nome}`);
      console.log(`Dispositivo: ${silo.dispositivo}`);
      console.log(`MAC: ${silo.macAddress}`);
      console.log(`Integrado: ${silo.integrado}`);
      
      let mqttEnviado = false;
      let erroMQTT = null;
      
      // Se silo está integrado, envia comando de reset
      if (silo.integrado && silo.macAddress) {
        try {
          const client = getMQTTClient();
          
          if (client.connected) {
            const comando = {
              acao: 'desintegrar',
              id: `delete_${Date.now()}`,
              macSilo: silo.macAddress,
              dispositivo: silo.dispositivo,
              timestamp: Date.now()
            };
            
            console.log('Comando MQTT:', JSON.stringify(comando, null, 2));
            
            client.publish('gateway/comando', JSON.stringify(comando));
            mqttEnviado = true;
            
            console.log(`✓ Comando reset enviado para MAC: ${silo.macAddress}`);
          } else {
            console.warn('MQTT desconectado');
            erroMQTT = 'MQTT desconectado';
          }
        } catch (mqttError) {
          console.error('✗ Erro MQTT:', mqttError);
          erroMQTT = mqttError.message;
        }
      } else if (silo.integrado && !silo.macAddress) {
        console.warn('Silo integrado mas sem MAC Address salvo');
        erroMQTT = 'MAC Address não encontrado';
      }
      
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
      
      res.status(200).json({ 
        success: true, 
        message: mqttEnviado 
          ? "Silo deletado. Comando de reset enviado ao ESP32."
          : "Silo deletado. " + (erroMQTT ? `Aviso: ${erroMQTT}` : "Não estava integrado."),
        dadosDeletados: dadosDeletados,
        mqttEnviado: mqttEnviado,
        erroMQTT: erroMQTT
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