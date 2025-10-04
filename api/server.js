import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env da raiz do projeto (2 níveis acima)
dotenv.config({ path: join(__dirname, '../.env') });

import app from "./src/app.js";
import { conectarMongoDB } from "./src/config/database.js";

const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB antes de iniciar o servidor
async function iniciarServidor() {
  try {
    // Conecta ao MongoDB
    await conectarMongoDB();
    
    // Inicia o servidor
    app.listen(PORT, () => {
      console.log(` Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error(" Erro ao iniciar servidor:", error.message);
    process.exit(1);
  }
}

iniciarServidor();