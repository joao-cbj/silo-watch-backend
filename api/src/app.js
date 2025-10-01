import express from "express";
import cors from "cors";
import { conectarMongoDB } from "./config/database.js";
import { DadosController } from "./controllers/DadosController.js";
import { validarDados } from "./middlewares/validarDados.js";

const app = express();

app.use(express.json());
app.use(cors());

// Conectar a cada request
app.use(async (req, res, next) => {
  try {
    await conectarMongoDB();
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: "Erro de conexão MongoDB" });
  }
});

// Rotas
app.get("/api/dados", DadosController.listar);
app.post("/api/dados", validarDados, DadosController.criar);

export default app;
