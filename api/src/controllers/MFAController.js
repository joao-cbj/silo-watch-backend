import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import Usuario from '../models/Usuario.js';

export class MFAController {
  // Verifica se o usuário tem MFA ativado
  static async status(req, res) {
    try {
      const userId = req.usuario.id; // Agora funciona!
      
      console.log('[MFA Status] Buscando usuário:', userId);
      
      const usuario = await Usuario.findById(userId);

      if (!usuario) {
        console.error('[MFA Status] Usuário não encontrado');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      console.log('[MFA Status] ✓ MFA enabled:', usuario.mfaEnabled);

      res.status(200).json({
        success: true,
        enabled: usuario.mfaEnabled || false
      });
    } catch (error) {
      console.error('[MFA Status] ✗ Erro:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao verificar status MFA'
      });
    }
  }

  // Configura MFA - gera QR Code e secret
  static async setup(req, res) {
    try {
      const userId = req.usuario.id;
      
      console.log('[MFA Setup] Configurando para usuário:', userId);
      
      const usuario = await Usuario.findById(userId);

      if (!usuario) {
        console.error('[MFA Setup] Usuário não encontrado');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Gera secret único
      const secret = speakeasy.generateSecret({
        name: `SiloWatch (${usuario.email})`,
        issuer: 'SiloWatch',
        length: 32
      });

      console.log('[MFA Setup] Secret gerado');

      // Gera QR Code
      const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Salva secret temporário (não ativa MFA ainda)
      usuario.mfaSecret = secret.base32;
      await usuario.save();

      console.log('[MFA Setup] ✓ Secret salvo');

      res.status(200).json({
        success: true,
        qrCode: qrCodeDataUrl,
        secret: secret.base32,
        message: 'QR Code gerado. Escaneie com Microsoft Authenticator'
      });
    } catch (error) {
      console.error('[MFA Setup] ✗ Erro:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao configurar MFA'
      });
    }
  }

  // Verifica código e ativa MFA
  static async verify(req, res) {
    try {
      const { code } = req.body;
      const userId = req.usuario.id;

      console.log('[MFA Verify] Verificando código');

      if (!code || code.length !== 6) {
        return res.status(400).json({
          success: false,
          error: 'Código deve ter 6 dígitos'
        });
      }

      const usuario = await Usuario.findById(userId);

      if (!usuario) {
        console.error('[MFA Verify] Usuário não encontrado');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      if (!usuario.mfaSecret) {
        console.error('[MFA Verify] Secret não encontrado');
        return res.status(400).json({
          success: false,
          error: 'Configure o MFA primeiro'
        });
      }

      // Verifica o código TOTP
      const verified = speakeasy.totp.verify({
        secret: usuario.mfaSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      console.log('[MFA Verify] Código verificado:', verified);

      if (verified) {
        // Ativa MFA
        usuario.mfaEnabled = true;
        await usuario.save();

        console.log('[MFA Verify] ✓ MFA ativado');

        res.status(200).json({
          success: true,
          message: 'Autenticação de dois fatores ativada com sucesso!'
        });
      } else {
        console.log('[MFA Verify] ✗ Código inválido');
        res.status(400).json({
          success: false,
          error: 'Código inválido. Tente novamente.'
        });
      }
    } catch (error) {
      console.error('[MFA Verify] ✗ Erro:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao verificar código MFA'
      });
    }
  }

  // Desativa MFA
  static async disable(req, res) {
    try {
      const userId = req.usuario.id;
      
      console.log('[MFA Disable] Desativando MFA');
      
      const usuario = await Usuario.findById(userId);

      if (!usuario) {
        console.error('[MFA Disable] Usuário não encontrado');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Remove MFA
      usuario.mfaEnabled = false;
      usuario.mfaSecret = null;
      await usuario.save();

      console.log('[MFA Disable] ✓ MFA desativado');

      res.status(200).json({
        success: true,
        message: 'Autenticação de dois fatores desativada'
      });
    } catch (error) {
      console.error('[MFA Disable] ✗ Erro:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao desativar MFA'
      });
    }
  }
}