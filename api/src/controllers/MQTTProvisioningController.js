import mqtt from 'mqtt';
import Silo from '../models/Silo.js';

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const MQTT_USER = process.env.MQTT_USER || '';
const MQTT_PASS = process.env.MQTT_PASS || '';

let mqttClient = null;

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

  return mqttClient;
}

connectMQTT();

export class MQTTProvisioningController {
  
  static async status(req, res) {
    try {
      const client = connectMQTT();
      const commandId = `ping_${Date.now()}`;
      
      let responded = false;
      const timeout = setTimeout(() => {
        if (!responded) {
          res.status(200).json({
            success: true,
            gateway: { online: false, method: 'mqtt' }
          });
        }
      }, 5000);

      const handler = (topic, message) => {
        if (topic === 'gateway/resposta/pong') {
          try {
            const data = JSON.parse(message.toString());
            if (data.id === commandId) {
              responded = true;
              clearTimeout(timeout);
              client.off('message', handler);
              
              res.status(200).json({
                success: true,
                gateway: { online: true, method: 'mqtt' }
              });
            }
          } catch (e) {
            console.error('Erro ao parsear pong:', e);
          }
        }
      };

      client.on('message', handler);

      client.publish('gateway/comando', JSON.stringify({
        acao: 'ping',
        id: commandId,
        timestamp: Date.now()
      }));

    } catch (error) {
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
      
      let responded = false;
      const timeout = setTimeout(() => {
        if (!responded) {
          res.status(200).json({
            success: true,
            dispositivos: [],
            total: 0
          });
        }
      }, 15000);

      const handler = (topic, message) => {
        if (topic === 'gateway/resposta/scan') {
          try {
            const data = JSON.parse(message.toString());
            if (data.id === commandId) {
              responded = true;
              clearTimeout(timeout);
              client.off('message', handler);
              
              res.status(200).json({
                success: true,
                dispositivos: data.dispositivos || [],
                total: data.dispositivos?.length || 0
              });
            }
          } catch (e) {
            console.error('Erro ao parsear scan:', e);
          }
        }
      };

      client.on('message', handler);

      client.publish('gateway/comando', JSON.stringify({
        acao: 'scan',
        id: commandId,
        timestamp: Date.now()
      }));

    } catch (error) {
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

      const client = connectMQTT();
      const commandId = `provision_${Date.now()}`;
      const dispositivoId = silo.nome.replace(/\s+/g, '_');
      
      let responded = false;
      const timeout = setTimeout(() => {
        if (!responded) {
          res.status(408).json({
            success: false,
            error: 'Timeout: Gateway não respondeu'
          });
        }
      }, 30000);

      const handler = (topic, message) => {
        if (topic === 'gateway/resposta/provision') {
          try {
            const data = JSON.parse(message.toString());
            if (data.id === commandId) {
              responded = true;
              clearTimeout(timeout);
              client.off('message', handler);
              
              if (data.status === 'provisionado') {
                silo.dispositivo = dispositivoId;
                silo.integrado = true;
                silo.save();

                res.status(200).json({
                  success: true,
                  message: 'Silo provisionado com sucesso via BLE',
                  silo: {
                    id: silo._id,
                    nome: silo.nome,
                    dispositivo: dispositivoId,
                    integrado: true
                  }
                });
              } else {
                res.status(400).json({
                  success: false,
                  error: data.error || 'Erro ao provisionar',
                  status: data.status
                });
              }
            }
          } catch (e) {
            console.error('Erro ao parsear provision:', e);
          }
        }
      };

      client.on('message', handler);

      client.publish('gateway/comando', JSON.stringify({
        acao: 'provisionar',
        id: commandId,
        macSilo: macSilo.toUpperCase(),
        siloNome: silo.nome,
        siloId: silo._id.toString(),
        timestamp: Date.now()
      }));

      console.log(`✓ Comando provision enviado: ${silo.nome} (${macSilo})`);

    } catch (error) {
      console.error('Erro ao provisionar:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async listarComandos(req, res) {
    try {
      const client = connectMQTT();
      
      res.status(200).json({
        success: true,
        mqtt: {
          connected: client.connected,
          broker: MQTT_BROKER
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}