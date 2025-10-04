import Usuario from "../models/Usuario.js";

class UsuarioRepository {
  async findAll() {
    return Usuario.find().lean();
  }

  async findById(usuarioId) {
    return Usuario.findById(usuarioId).lean();
  }

  async create(dadosUsuario) {
    const usuario = new Usuario(dadosUsuario);
    return usuario.save();
  }

  async update(usuarioId, dadosParaAtualizar) {
    return Usuario.findByIdAndUpdate(
      usuarioId, 
      dadosParaAtualizar, 
      { new: true }
    );
  }

  async delete(usuarioId) {
    return Usuario.findByIdAndDelete(usuarioId);
  }
}

export default new UsuarioRepository();