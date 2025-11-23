// controllers/HybridProvisioningController.js
import admin from 'firebase-admin';
import Silo from '../models/Silo.js';

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

// Inicializa Firebase Admin (uma vez)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

export class HybridProvisioningController {
  /**
   * Escaneia dispositivos BLE via Gateway
   * POST /api/hybrid-provisioning/scan
   */
  static async scan(req, res) {
    try {
      const timestamp = Date.now();
      const comandoPath = `/comandos/scan_${timestamp}`;
      
      // Escreve comando de scan no Firebase
      await db.ref(comandoPath).set({
        acao: 'scan',
        timestamp,
        status: 'aguardando'
      });
      
      console.log('✓ Comando de scan enviado ao Gateway');
      
      // Aguarda resposta do Gateway (polling por até 15s)
      let tentativas = 0;
      let dispositivos = [];
      
      while (tentativas < 30) { // 30 * 500ms = 15s
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const snapshot = await db.ref(`${comandoPath}/dispositivos`).once('value');
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          dispositivos = Array.isArray(data) ? data : [];
          break;
        }
        
        tentativas++;
      }
      
      // Remove comando do Firebase (limpeza)
      await db.ref(comandoPath).remove();
      
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

  /**
   * Provisiona silo via BLE (Gateway recebe comando do Firebase)
   * POST /api/hybrid-provisioning/provision
   * Body: { siloId, macSilo }
   */
  static async provision(req, res) {
    try {
      const { siloId, macSilo } = req.body;

      if (!siloId || !macSilo) {
        return res.status(400).json({
          success: false,
          error: 'siloId e macSilo são obrigatórios'
        });
      }

      // Busca o silo no banco
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
      const comandoPath = `/comandos/provision_${timestamp}`;
      
      // Gera nome do dispositivo
      const dispositivoId = silo.nome.replace(/\s+/g, '_');

      // Escreve comando de provisionamento no Firebase
      await db.ref(comandoPath).set({
        acao: 'provisionar',
        macSilo: macSilo.toUpperCase(),
        siloNome: silo.nome,
        siloId: silo._id.toString(),
        timestamp,
        status: 'aguardando'
      });

      console.log(`✓ Comando de provisionamento enviado ao Gateway`);
      console.log(`  Silo: ${silo.nome}`);
      console.log(`  MAC: ${macSilo}`);

      // Aguarda confirmação do Gateway (polling por até 30s)
      let tentativas = 0;
      let provisionado = false;
      let statusFinal = 'timeout';

      while (tentativas < 60) { // 60 * 500ms = 30s
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const snapshot = await db.ref(`${comandoPath}/status`).once('value');
        
        if (snapshot.exists()) {
          statusFinal = snapshot.val();
          
          if (statusFinal === 'provisionado') {
            provisionado = true;
            break;
          } else if (statusFinal.startsWith('erro')) {
            break;
          }
        }
        
        tentativas++;
      }

      // Remove comando do Firebase (limpeza)
      await db.ref(comandoPath).remove();

      // Verifica resultado
      if (!provisionado) {
        let mensagemErro = 'Erro desconhecido';
        
        switch (statusFinal) {
          case 'timeout':
            mensagemErro = 'Timeout: Gateway não respondeu';
            break;
          case 'erro_scan':
            mensagemErro = 'Nenhum dispositivo BLE encontrado';
            break;
          case 'erro_nao_encontrado':
            mensagemErro = 'Silo não encontrado no scan BLE';
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

      // Atualiza o silo no banco
      silo.dispositivo = dispositivoId;
      silo.integrado = true;
      await silo.save();

      console.log(`✓ Silo ${silo.nome} provisionado com sucesso`);

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

  /**
   * Verifica status do Gateway
   * GET /api/hybrid-provisioning/status
   */
static async status(req, res) {
  try {
    const timestamp = Date.now();
    
    // Escreve diretamente em /comandos
    await db.ref('/comandos').set({
      acao: 'ping',
      timestamp,
      id: `ping_${timestamp}`
    });
    
    console.log('✓ Ping enviado ao Gateway');
    
    // Aguarda resposta em /comandos/pong
    let tentativas = 0;
    let online = false;
    
    while (tentativas < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const snapshot = await db.ref('/comandos/pong').once('value');
      
      if (snapshot.exists()) {
        online = true;
        break;
      }
      
      tentativas++;
    }
    
    // Limpa após uso
    await db.ref('/comandos/pong').remove();
    
    res.status(200).json({
      success: true,
      gateway: { online, method: 'firebase+ble' }
    });
    
  } catch (error) {
    res.status(200).json({
      success: true,
      gateway: { online: false, error: error.message }
    });
  }
}

  /**
   * Lista comandos pendentes (debug)
   * GET /api/hybrid-provisioning/comandos
   */
  static async listarComandos(req, res) {
    try {
      const snapshot = await db.ref('/comandos').once('value');
      const comandos = [];
      
      snapshot.forEach((child) => {
        comandos.push({
          key: child.key,
          ...child.val()
        });
      });
      
      res.status(200).json({
        success: true,
        comandos,
        total: comandos.length
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Limpa comandos antigos (manutenção)
   * DELETE /api/hybrid-provisioning/limpar
   */
  static async limparComandos(req, res) {
    try {
      await db.ref('/comandos').remove();
      
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