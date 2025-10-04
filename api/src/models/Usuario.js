import mongoose from "mongoose";

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  criadoEm: { type: Date, default: Date.now }
});

export default mongoose.models.Usuario || mongoose.model("Usuario", UsuarioSchema);
