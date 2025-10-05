import { AuthService } from "../services/AuthService.js";

const authService = new AuthService();

export class AuthController {
  static async login(req, res) {
    try {
      const { email, senha } = req.body;
      
      if (!email || !senha) {
        return res.status(400).json({ 
          success: false, 
          error: "Email e senha são obrigatórios" 
        });
      }

      const resultado = await authService.login(email, senha);
      res.status(200).json({ 
        success: true, 
        ...resultado 
      });
    } catch (error) {
      const statusCode = error.message === "Credenciais inválidas" ? 401 : 500;
      res.status(statusCode).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static async verificarToken(req, res) {
    try {
      // O middleware já validou o token e anexou o usuário em req.usuario
      res.status(200).json({ 
        success: true, 
        usuario: req.usuario 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}