import mongoose from 'mongoose';
import cors from 'cors';

// Middleware CORS
const corsOptions = {
  origin: ['http://localhost:3000', 'https://seu-frontend.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Schema MongoDB
const DadosSchema = new mongoose.Schema({
  temperatura: { type: Number, required: true },
  umidade: { type: Number, required: true },
  dispositivo: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

let Dados;

// Conectar ao MongoDB
async function conectarMongoDB() {
  if (mongoose.connections[0].readyState) {
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB conectado');
  } catch (error) {
    console.error('Erro ao conectar MongoDB:', error);
    throw error;
  }
}

// Handler principal da Vercel
export default async function handler(req, res) {
  // Aplicar CORS
  await new Promise((resolve, reject) => {
    cors(corsOptions)(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });

  // Conectar ao banco
  await conectarMongoDB();
  
  // Inicializar modelo se não existir
  if (!Dados) {
    Dados = mongoose.models.Dados || mongoose.model('Dados', DadosSchema);
  }

  const { method } = req;

  switch (method) {
    case 'POST':
      return await criarDados(req, res);
    case 'GET':
      return await obterDados(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Método ${method} não permitido` });
  }
}

// Criar novos dados (ESP32 → API)
async function criarDados(req, res) {
  try {
    const { temperatura, umidade, dispositivo } = req.body;

    // Validação básica
    if (!temperatura || !umidade || !dispositivo) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: temperatura, umidade, dispositivo' 
      });
    }

    const novosDados = new Dados({
      temperatura: parseFloat(temperatura),
      umidade: parseFloat(umidade),
      dispositivo: String(dispositivo),
    });

    const dadosSalvos = await novosDados.save();

    return res.status(201).json({
      success: true,
      message: 'Dados salvos com sucesso',
      id: dadosSalvos._id,
      timestamp: dadosSalvos.timestamp
    });

  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}

// Obter dados (Dashboard → API)
async function obterDados(req, res) {
  try {
    const { limite = 50, dispositivo, dataInicio, dataFim } = req.query;

    // Construir filtros
    let filtros = {};
    
    if (dispositivo) {
      filtros.dispositivo = dispositivo;
    }

    if (dataInicio || dataFim) {
      filtros.timestamp = {};
      if (dataInicio) filtros.timestamp.$gte = new Date(dataInicio);
      if (dataFim) filtros.timestamp.$lte = new Date(dataFim);
    }

    // Buscar dados
    const dados = await Dados
      .find(filtros)
      .sort({ timestamp: -1 })
      .limit(parseInt(limite))
      .lean();

    // Estatísticas básicas
    const total = await Dados.countDocuments(filtros);
    const dispositivos = await Dados.distinct('dispositivo');

    return res.status(200).json({
      success: true,
      dados,
      estatisticas: {
        total,
        dispositivosAtivos: dispositivos.length,
        ultimaAtualizacao: dados[0]?.timestamp || null
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar dados',
      details: error.message 
    });
  }
}