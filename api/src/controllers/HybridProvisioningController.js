// controllers/HybridProvisioningController.js
import admin from 'firebase-admin';
import Silo from '../models/Silo.js';

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

export class HybridProvisioningController {
  
  static async scan(req, res) {
    try {
      const timestamp = Date.now();
      const commandId = `scan_${timestamp}`;
      
      await db.ref('/gateway/resposta/dispositivos').remove();
      
      await db.ref('/gateway/comando').set({
        acao: 'scan',
        id: commandId,
        timestamp
      });
      
      console.log('Comando scan enviado');
      
      let tentativas = 0;
      let dispositivos = [];
      
      while (tentativas < 30) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const snapshot = await db.ref('/gateway/resposta/dispositivos').once('value');
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          
          if (typeof data === 'string') {
            try {
              dispositivos = JSON.parse(data);
            } catch {
              dispositivos = [];
            }
          } else if (Array.isArray(data)) {
            dispositivos = data;
          }
          
          break;
        }
        
        tentativas++;
      }
      
      res.status(200).json({
        success: true,
        dispositivos,
        total: dispositivos.length
      });
      
    } catch (error) {
      console.error('Erro ao escanear:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao escanear dispositivos BLE'
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

      const timestamp = Date.now();
      const commandId = `provision_${timestamp}`;
      const dispositivoId = silo.nome.replace(/\s+/g, '_');

      await db.ref('/gateway/resposta/status').remove();

      await db.ref('/gateway/comando').set({
        acao: 'provisionar',
        id: commandId,
        macSilo: macSilo.toUpperCase(),
        siloNome: silo.nome,
        siloId: silo._id.toString(),
        timestamp
      });

      console.log(`Comando provision enviado: ${silo.nome}`);

      let tentativas = 0;
      let provisionado = false;
      let statusFinal = 'timeout';

      while (tentativas < 60) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const snapshot = await db.ref('/gateway/resposta/status').once('value');
        
        if (snapshot.exists()) {
          statusFinal = snapshot.val();
          
          if (statusFinal === 'provisionado') {
            provisionado = true;
            break;
          } else if (statusFinal && statusFinal.startsWith('erro')) {
            break;
          }
        }
        
        tentativas++;
      }

      if (!provisionado) {
        let mensagemErro = 'Erro desconhecido';
        
        switch (statusFinal) {
          case 'timeout':
            mensagemErro = 'Timeout: Gateway não respondeu';
            break;
          case 'erro_ble':
            mensagemErro = 'Erro ao conectar via BLE';
            break;
        }
        
        return res.status(408).json({
          success: false,
          error: mensagemErro,
          status: statusFinal
        });
      }

      silo.dispositivo = dispositivoId;
      silo.integrado = true;
      await silo.save();

      console.log(`Silo ${silo.nome} provisionado`);

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

    } catch (error) {
      console.error('Erro ao provisionar:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao provisionar dispositivo'
      });
    }
  }

  static async status(req, res) {
    try {
      const timestamp = Date.now();
      const commandId = `ping_${timestamp}`;
      
      await db.ref('/gateway/resposta/pong').remove();
      
      await db.ref('/gateway/comando').set({
        acao: 'ping',
        id: commandId,
        timestamp
      });
      
      console.log('Ping enviado:', commandId);
      
      let tentativas = 0;
      let online = false;
      
      while (tentativas < 15) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const snapshot = await db.ref('/gateway/resposta/pong').once('value');
        
        if (snapshot.exists() && snapshot.val() === true) {
          online = true;
          console.log('Pong recebido!');
          break;
        }
        
        tentativas++;
      }
      
      if (!online) {
        console.log('Gateway não respondeu');
      }
      
      res.status(200).json({
        success: true,
        gateway: { 
          online, 
          method: 'firebase+ble',
          lastPing: commandId
        }
      });
      
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      res.status(200).json({
        success: true,
        gateway: { 
          online: false, 
          error: error.message 
        }
      });
    }
  }

  static async listarComandos(req, res) {
    try {
      const snapshot = await db.ref('/gateway').once('value');
      
      if (!snapshot.exists()) {
        return res.status(200).json({
          success: true,
          gateway: null
        });
      }
      
      res.status(200).json({
        success: true,
        gateway: snapshot.val()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async limparComandos(req, res) {
    try {
      await db.ref('/gateway').remove();
      
      console.log('Gateway limpo');
      
      res.status(200).json({
        success: true,
        message: 'Comandos limpos com sucesso'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}