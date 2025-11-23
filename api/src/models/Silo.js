import mongoose from "mongoose";

const SiloSchema = new mongoose.Schema({
  nome: { 
    type: String, 
    required: true,
    trim: true 
  },
  tipoSilo: {
    type: String,
    required: true,
    enum: ['superficie', 'trincheira', 'cilindrico', 'silo-bolsa']
  },
  dispositivo: { 
    type: String, 
    unique: true,
    sparse: true, // Permite múltiplos documentos sem dispositivo
    trim: true
  },
  integrado: {
    type: Boolean,
    default: false
  },
  criadoEm: { 
    type: Date, 
    default: Date.now 
  },
  atualizadoEm: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índice para busca rápida por dispositivo
SiloSchema.index({ dispositivo: 1 });

export default mongoose.models.Silo || mongoose.model("Silo", SiloSchema);