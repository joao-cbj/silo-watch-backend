import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

export class AuthService {
  async login(email, senha) {
    // Buscar usuário
    const usuario = await Usuario.findOne({ email });
    
    if (!usuario) {
      throw new Error("Credenciais inválidas");
    }

    // Verificar senha
    const senhaValida = await usuario.compararSenha(senha);
    if (!senhaValida) {
      throw new Error("Credenciais inválidas");
    }

    // Gerar token JWT com tipo de usuário
    const token = jwt.sign(
      { 
        _id: usuario._id.toString(),
        id: usuario._id.toString(), // Adiciona id também
        email: usuario.email,
        nome: usuario.nome,
        tipo: usuario.tipo // IMPORTANTE: Incluir tipo no token
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Retornar token e dados do usuário (sem senha)
    return {
      token,
      usuario: {
        _id: usuario._id.toString(),
        id: usuario._id.toString(),
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo, // IMPORTANTE: Incluir tipo na resposta
        createdAt: usuario.createdAt,
        mfaEnabled: usuario.mfaEnabled
      }
    };
  }
}