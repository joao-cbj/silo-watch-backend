import UsuarioRepository from "../repositories/UsuarioRepository.js";
import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

export class AuthService {
  async login(email, senha) {
    // Buscar usuário (não pode usar .lean() porque precisamos dos métodos)
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
        id: usuario._id, 
        email: usuario.email,
        nome: usuario.nome 
      },
      process.env.JWT_SECRET || "seu_secret_aqui_mude_isso",
      { expiresIn: "7d" }
    );

    // Retornar token e dados do usuário (sem senha)
    return {
      token,
      usuario: {
        _id: usuario._id,
        nome: usuario.nome,
        email: usuario.email
      }
    };
  }
}