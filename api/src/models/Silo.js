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
    sparse: true,  // Permite múltiplos valores null
    trim: true,
    index: true 
  },
  // Campo para MAC Address do ESP32
  macAddress: {
    type: String,
    unique: true,
    sparse: true,  // Permite múltiplos valores null
    uppercase: true,
    trim: true,
    index: true,   
    validate: {
      validator: function(v) {
        // Valida formato MAC: XX:XX:XX:XX:XX:XX
        return !v || /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v);
      },
      message: props => `${props.value} não é um MAC Address válido!`
    }
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


SiloSchema.index({ integrado: 1, dispositivo: 1 });

export default mongoose.models.Silo || mongoose.model("Silo", SiloSchema);