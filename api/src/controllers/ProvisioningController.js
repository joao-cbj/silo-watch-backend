// controllers/ProvisioningController.js
import axios from 'axios';

// Configuração do Gateway
// Use hostname mDNS (recomendado) ou IP fixo
const GATEWAY_HOST = process.env.GATEWAY_HOST || 'gateway.local'; // ou '192.168.1.100'
const GATEWAY_URL = `http://${GATEWAY_HOST}`;

export class ProvisioningController {
  /**
   * Verificar se o gateway está online
   * GET /api/provisioning/ping
   */
  static async ping(req, res) {
    try {
      const response = await axios.get(`${GATEWAY_URL}/ping`, {
        timeout: 3000
      });

      res.status(200).json({
        success: true,
        gateway: {
          online: true,
          host: GATEWAY_HOST,
          url: GATEWAY_URL
        }
      });
    } catch (error) {
      res.status(200).json({
        success: false,
        gateway: {
          online: false,
          host: GATEWAY_HOST,
          error: "Gateway offline ou inacessível"
        }
      });
    }
  }

  /**
   * Escanear por novos silos via BLE
   * POST /api/provisioning/scan
   */
  static async scan(req, res) {
    try {
      console.log(`Enviando comando de scan para ${GATEWAY_URL}/scan`);
      
      const response = await axios.post(`${GATEWAY_URL}/scan`, {}, {
        timeout: 15000 // 15 segundos para o scan BLE
      });

      res.status(200).json({
        success: true,
        message: "Scan concluído",
        dispositivos: response.data.dispositivos || [],
        total: response.data.dispositivos?.length || 0
      });
    } catch (error) {
      console.error("Erro ao escanear:", error.message);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return res.status(503).json({
          success: false,
          error: `Gateway offline. Verifique se está ligado e acessível em ${GATEWAY_HOST}`
        });
      }
      
      res.status(500).json({
        success: false,
        error: error.response?.data?.error || "Erro ao escanear dispositivos"
      });
    }
  }

  /**
   * Provisionar um novo silo
   * POST /api/provisioning/provision
   * Body: { siloId, bleAddress }
   */
  static async provision(req, res) {
    try {
      const { siloId, bleAddress } = req.body;

      if (!siloId || !bleAddress) {
        return res.status(400).json({
          success: false,
          error: "siloId e bleAddress são obrigatórios"
        });
      }

      // Busca informações do silo no banco
      const Silo = (await import('../models/Silo.js')).default;
      const silo = await Silo.findById(siloId);

      if (!silo) {
        return res.status(404).json({
          success: false,
          error: "Silo não encontrado"
        });
      }

      if (silo.integrado) {
        return res.status(400).json({
          success: false,
          error: "Este silo já está integrado"
        });
      }

      // Gera ID do dispositivo (usa o nome do silo)
      const dispositivoId = silo.nome.replace(/\s+/g, '_');

      console.log(`Provisionando silo: ${silo.nome} (${bleAddress})`);

      // Envia comando para o Gateway
      const response = await axios.post(`${GATEWAY_URL}/provision`, {
        bleAddress,
        siloNome: silo.nome,
        siloId: silo._id.toString()
      }, {
        timeout: 30000 // 30 segundos para provisionamento
      });

      if (response.data.success) {
        // Atualiza o silo no banco de dados
        silo.dispositivo = dispositivoId;
        silo.integrado = true;
        await silo.save();

        console.log(`✓ Silo ${silo.nome} provisionado com sucesso`);

        res.status(200).json({
          success: true,
          message: "Silo provisionado com sucesso",
          silo: {
            id: silo._id,
            nome: silo.nome,
            dispositivo: dispositivoId,
            integrado: true
          }
        });
      } else {
        throw new Error(response.data.error || "Erro ao provisionar");
      }
    } catch (error) {
      console.error("Erro ao provisionar:", error.message);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({
          success: false,
          error: `Gateway offline. Verifique a conexão em ${GATEWAY_HOST}`
        });
      }
      
      res.status(500).json({
        success: false,
        error: error.response?.data?.error || error.message || "Erro ao provisionar dispositivo"
      });
    }
  }

  /**
   * Verificar status do gateway
   * GET /api/provisioning/status
   */
  static async status(req, res) {
    try {
      const response = await axios.get(`${GATEWAY_URL}/status`, {
        timeout: 5000
      });

      res.status(200).json({
        success: true,
        gateway: {
          online: true,
          host: GATEWAY_HOST,
          ...response.data
        }
      });
    } catch (error) {
      res.status(200).json({
        success: true,
        gateway: {
          online: false,
          host: GATEWAY_HOST,
          message: "Gateway offline ou inacessível"
        }
      });
    }
  }
}