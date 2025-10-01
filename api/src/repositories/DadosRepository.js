import mongoose from "mongoose";

const DadosSchema = new mongoose.Schema({
  temperatura: { type: Number, required: true },
  umidade: { type: Number, required: true },
  dispositivo: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.Dados || mongoose.model("Dados", DadosSchema);
