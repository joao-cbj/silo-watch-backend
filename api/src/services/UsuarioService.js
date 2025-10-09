import UsuarioRepository from "../repositories/UsuarioRepository.js";
import Usuario from "../models/Usuario.js";

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

    // Não permitir atualização direta da senha por este método
    if (dadosParaAtualizar.senha) {
      throw new Error("Use o endpoint de alteração de senha para modificar a senha");
    }

    const usuarioAtualizado = await UsuarioRepository.update(usuarioId, dadosParaAtualizar);
    if (!usuarioAtualizado) {
      throw new Error("Usuário não encontrado");
    }
    return usuarioAtualizado;
  }

  // NOVO MÉTODO - Alteração de Senha
  async alterarSenha(usuarioId, senhaAtual, novaSenha) {
    // Buscar usuário com senha (não usar .lean() para ter acesso aos métodos)
    const usuario = await Usuario.findById(usuarioId);
    
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    // Verificar se a senha atual está correta
    const senhaCorreta = await usuario.compararSenha(senhaAtual);
    if (!senhaCorreta) {
      throw new Error("Senha atual incorreta");
    }

    // Validações da nova senha
    if (novaSenha.length < 8) {
      throw new Error("A nova senha deve ter no mínimo 8 caracteres");
    }

    // Validar complexidade da senha
    const temMaiuscula = /[A-Z]/.test(novaSenha);
    const temMinuscula = /[a-z]/.test(novaSenha);
    const temNumero = /[0-9]/.test(novaSenha);
    const temEspecial = /[!@#$%^&*(),.?":{}|<>]/.test(novaSenha);

    if (!temMaiuscula || !temMinuscula || !temNumero || !temEspecial) {
      throw new Error("A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais");
    }

    // Atualizar senha (o pre-save hook do modelo fará o hash automaticamente)
    usuario.senha = novaSenha;
    await usuario.save();

    return true;
  }

  async deletar(usuarioId) {
    const usuarioDeletado = await UsuarioRepository.delete(usuarioId);
    if (!usuarioDeletado) {
      throw new Error("Usuário não encontrado");
    }
    return usuarioDeletado;
  }
}