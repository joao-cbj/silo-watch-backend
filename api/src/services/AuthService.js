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

    // Gerar token JWT
    const token = jwt.sign(
      { 
        _id: usuario._id.toString(), // Mantém _id (será convertido para id no middleware)
        email: usuario.email,
        nome: usuario.nome 
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Retornar token e dados do usuário (sem senha)
    return {
      token,
      usuario: {
        id: usuario._id.toString(),
        nome: usuario.nome,
        email: usuario.email
      }
    };
  }
}