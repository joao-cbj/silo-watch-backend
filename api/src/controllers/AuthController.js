import { AuthService } from "../services/AuthService.js";
import speakeasy from 'speakeasy';
import Usuario from '../models/Usuario.js';

const authService = new AuthService();

export class AuthController {
  // Login com verificação de MFA
  static async login(req, res) {
    try {
      const { email, senha, mfaCode } = req.body;
      console.log('[Auth Login] Tentativa de login:', email);

      if (!email || !senha) {
        return res.status(400).json({ 
          success: false, 
          error: "Email e senha são obrigatórios" 
        });
      }

      // Busca usuário
      const usuario = await Usuario.findOne({ email });
      if (!usuario || !(await usuario.compararSenha(senha))) {
        console.log('[Auth Login] ✗ Credenciais inválidas');
        return res.status(401).json({
          success: false,
          error: "Credenciais inválidas"
        });
      }

      console.log('[Auth Login] Credenciais válidas. MFA enabled:', usuario.mfaEnabled);

      // Verifica se MFA está ativo
      if (usuario.mfaEnabled) {
        // Se MFA está ativo mas código não foi enviado
        if (!mfaCode) {
          console.log('[Auth Login] MFA necessário, mas código não fornecido');
          return res.status(200).json({
            success: false,
            requiresMFA: true,
            message: "Digite o código do Microsoft Authenticator"
          });
        }

        // Valida código MFA
        console.log('[Auth Login] Verificando código MFA...');
        const verified = speakeasy.totp.verify({
          secret: usuario.mfaSecret,
          encoding: 'base32',
          token: mfaCode,
          window: 2
        });

        if (!verified) {
          console.log('[Auth Login] ✗ Código MFA inválido');
          return res.status(401).json({
            success: false,
            error: "Código MFA inválido"
          });
        }

        console.log('[Auth Login] ✓ Código MFA válido');
      }

      // Login bem-sucedido - gera token
      const resultado = await authService.login(email, senha);
      console.log('[Auth Login] ✓ Login bem-sucedido. Token gerado. Tipo:', usuario.tipo);
      
      res.status(200).json({ 
        success: true, 
        ...resultado,
        usuario: {
          ...resultado.usuario,
          tipo: usuario.tipo // Garante que o tipo está incluído
        }
      });
    } catch (error) {
      console.error('[Auth Login] ✗ Erro:', error.message);
      const statusCode = error.message === "Credenciais inválidas" ? 401 : 500;
      res.status(statusCode).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static async verificarToken(req, res) {
    try {
      // Busca usuário completo para incluir o tipo
      const usuario = await Usuario.findById(req.usuario._id || req.usuario.id).lean();
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          error: "Usuário não encontrado"
        });
      }

      res.status(200).json({ 
        success: true, 
        usuario: {
          _id: usuario._id,
          id: usuario._id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo,
          createdAt: usuario.createdAt
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