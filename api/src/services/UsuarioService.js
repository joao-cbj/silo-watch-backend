import UsuarioRepository from "../repositories/UsuarioRepository.js";

export class UsuarioService {
  async criar(dadosUsuario) {
    
    if (!dadosUsuario.nome || !dadosUsuario.email || !dadosUsuario.senha) {
      throw new Error("Nome, email e senha são obrigatórios");
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dadosUsuario.email)) {
      throw new Error("Email inválido");
    }

    return await UsuarioRepository.create(dadosUsuario);
  }

  async listar() {
    return await UsuarioRepository.findAll();
  }

  async buscarPorId(usuarioId) {
    const usuario = await UsuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }
    return usuario;
  }

  async atualizar(usuarioId, dadosParaAtualizar) {
    // Validar email se estiver sendo atualizado
    if (dadosParaAtualizar.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dadosParaAtualizar.email)) {
        throw new Error("Email inválido");
      }
    }

    const usuarioAtualizado = await UsuarioRepository.update(usuarioId, dadosParaAtualizar);
    if (!usuarioAtualizado) {
      throw new Error("Usuário não encontrado");
    }
    return usuarioAtualizado;
  }

  async deletar(usuarioId) {
    const usuarioDeletado = await UsuarioRepository.delete(usuarioId);
    if (!usuarioDeletado) {
      throw new Error("Usuário não encontrado");
    }
    return usuarioDeletado;
  }
}