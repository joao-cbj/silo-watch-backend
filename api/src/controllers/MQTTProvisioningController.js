import mqtt from 'mqtt';
import Silo from '../models/Silo.js';

const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;

let mqttClient = null;
const pendingRequests = new Map();

function connectMQTT() {
  if (mqttClient && mqttClient.connected) return mqttClient;

  mqttClient = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: `backend_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log('✓ MQTT conectado');
    mqttClient.subscribe('gateway/resposta/#', (err) => {
      if (err) console.error('Erro ao subscrever:', err);
    });
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT erro:', err);
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      const commandId = data.id;

      if (commandId && pendingRequests.has(commandId)) {
        const { resolve, timeout } = pendingRequests.get(commandId);
        clearTimeout(timeout);
        pendingRequests.delete(commandId);
        resolve({ topic, data });
      }
    } catch (e) {
      console.error('Erro ao processar mensagem MQTT:', e);
    }
  });

  return mqttClient;
}

function waitForMQTTResponse(commandId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(commandId);
      reject(new Error('Timeout: Gateway não respondeu'));
    }, timeoutMs);

    pendingRequests.set(commandId, { resolve, timeout });
  });
}

connectMQTT();

export class MQTTProvisioningController {
  
  static async status(req, res) {
    try {
      const client = connectMQTT();
      const commandId = `ping_${Date.now()}`;
      
      const responsePromise = waitForMQTTResponse(commandId, 5000);

      client.publish('gateway/comando', JSON.stringify({
        acao: 'ping',
        id: commandId,
        timestamp: Date.now()
      }));

      try {
        const { topic, data } = await responsePromise;
        
        if (topic === 'gateway/resposta/pong') {
          return res.status(200).json({
            success: true,
            gateway: { online: true, method: 'mqtt' }
          });
        }
      } catch (error) {
        return res.status(200).json({
          success: true,
          gateway: { online: false, method: 'mqtt' }
        });
      }

    } catch (error) {
      console.error('Erro em status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async scan(req, res) {
    try {
      const client = connectMQTT();
      const commandId = `scan_${Date.now()}`;
      
      const responsePromise = waitForMQTTResponse(commandId, 15000);

      client.publish('gateway/comando', JSON.stringify({
        acao: 'scan',
        id: commandId,
        timestamp: Date.now()
      }));

      try {
        const { topic, data } = await responsePromise;
        
        if (topic === 'gateway/resposta/scan') {
          return res.status(200).json({
            success: true,
            dispositivos: data.dispositivos || [],
            total: data.dispositivos?.length || 0
          });
        }
      } catch (error) {
        return res.status(200).json({
          success: true,
          dispositivos: [],
          total: 0,
          message: 'Timeout ao escanear dispositivos'
        });
      }

    } catch (error) {
      console.error('Erro em scan:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async provision(req, res) {
    try {
      const { siloId, macSilo } = req.body;

      if (!siloId || !macSilo) {
        return res.status(400).json({
          success: false,
          error: 'siloId e macSilo são obrigatórios'
        });
      }

      const silo = await Silo.findById(siloId);

      if (!silo) {
        return res.status(404).json({
          success: false,
          error: 'Silo não encontrado'
        });
      }

      if (silo.integrado) {
        return res.status(400).json({
          success: false,
          error: 'Este silo já está integrado'
        });
      }

      console.log(`\n=== PROVISIONAR SILO ===`);
      console.log(`ID: ${siloId}`);
      console.log(`Nome: ${silo.nome}`);
      console.log(`MAC: ${macSilo}`);

      const client = connectMQTT();
      const commandId = `provision_${Date.now()}`;
      
      // envia o _id do silo como dispositivo
      const dispositivoId = silo._id.toString();
      
      const responsePromise = waitForMQTTResponse(commandId, 30000);

      client.publish('gateway/comando', JSON.stringify({
        acao: 'provisionar',
        id: commandId,
        macSilo: macSilo.toUpperCase(),
        siloNome: silo.nome,  // Mantido para log/debug no gateway
        siloId: dispositivoId,  // Agora envia o _id do silo
        timestamp: Date.now()
      }));

      console.log(`✓ Comando provision enviado: ${silo.nome} (${macSilo})`);
      console.log(`✓ Dispositivo ID: ${dispositivoId}`);

      try {
        const { topic, data } = await responsePromise;
        
        if (topic === 'gateway/resposta/provision') {
          if (data.status === 'provisionado') {
            // dispositivo agora é o _id do silo
            silo.dispositivo = dispositivoId;
            silo.macAddress = macSilo.toUpperCase();
            silo.integrado = true;
            await silo.save();

            console.log(`✓ Silo provisionado:`);
            console.log(`  Nome: ${silo.nome}`);
            console.log(`  Dispositivo: ${dispositivoId}`);
            console.log(`  MAC: ${silo.macAddress}`);

            return res.status(200).json({
              success: true,
              message: 'Silo provisionado com sucesso via BLE',
              silo: {
                id: silo._id,
                nome: silo.nome,
                dispositivo: dispositivoId,
                macAddress: silo.macAddress,
                integrado: true
              }
            });
          } else {
            return res.status(400).json({
              success: false,
              error: data.error || 'Erro ao provisionar',
              status: data.status
            });
          }
        }
      } catch (error) {
        return res.status(408).json({
          success: false,
          error: error.message
        });
      }

    } catch (error) {
      console.error('Erro ao provisionar:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Desintegrar atualiza o banco, não envia comando pra ESP
  static async desintegrar(req, res) {
    try {
      const { siloId } = req.body;

      if (!siloId) {
        return res.status(400).json({
          success: false,
          error: 'siloId é obrigatório'
        });
      }

      const silo = await Silo.findById(siloId);

      if (!silo) {
        return res.status(404).json({
          success: false,
          error: 'Silo não encontrado'
        });
      }

      if (!silo.integrado) {
        return res.status(400).json({
          success: false,
          error: 'Este silo não está integrado'
        });
      }

      console.log(`\n=== DESINTEGRAR SILO ===`);
      console.log(`ID: ${siloId}`);
      console.log(`Nome: ${silo.nome}`);
      console.log(`Dispositivo: ${silo.dispositivo}`);
      console.log(`MAC Address: ${silo.macAddress}`);

      // Apenas atualiza banco, não envia comando
      silo.dispositivo = null;
      silo.macAddress = null;
      silo.integrado = false;
      await silo.save();

      console.log(`✓ Silo desintegrado no banco. Reset manual necessário no ESP32.`);

      return res.status(200).json({
        success: true,
        message: 'Silo desintegrado no sistema. Pressione o botão do ESP32 por 3 segundos para resetar a memória.',
        silo: {
          id: silo._id,
          nome: silo.nome,
          integrado: false
        }
      });

    } catch (error) {
      console.error('Erro ao desintegrar:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Não há mais atualização de nome na ESP

  static async listarComandos(req, res) {
    try {
      const client = connectMQTT();
      
      res.status(200).json({
        success: true,
        mqtt: {
          connected: client.connected,
          broker: MQTT_BROKER
        },
        comandos: [
          { acao: 'ping', descricao: 'Verifica se o gateway está online' },
          { acao: 'scan', descricao: 'Escaneia dispositivos BLE disponíveis' },
          { acao: 'provisionar', descricao: 'Provisiona um novo silo via BLE' }
        ]
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}