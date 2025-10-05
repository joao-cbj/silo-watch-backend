import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true }
}, {
  timestamps: true,
  collection: 'usuarios'
});

// Hash da senha antes de salvar
UsuarioSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 10);
  next();
});

// Método para comparar senha
UsuarioSchema.methods.compararSenha = async function(senhaInformada) {
  return await bcrypt.compare(senhaInformada, this.senha);
};

export default mongoose.model("Usuario", UsuarioSchema);