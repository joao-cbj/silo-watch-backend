import express from "express";
import cors from "cors";
import { conectarMongoDB } from "./config/database.js";
import { DadosController } from "./controllers/DadosController.js";
import { UsuarioController } from "./controllers/UsuarioController.js";
import { validarDados } from "./middlewares/validarDados.js";
import { validarUsuario } from "./middlewares/validarUsuario.js";

const app = express();

app.use(express.json());
app.use(cors());

// ===== ROTAS DE DADOS (ESP32) =====
app.get("/api/dados", DadosController.listar);
app.post("/api/dados", validarDados, DadosController.criar);

// ===== ROTAS DE USUÁRIOS  =====
app.get("/api/usuarios", UsuarioController.listar);
app.get("/api/usuarios/:id", UsuarioController.buscarPorId);
app.post("/api/usuarios", validarUsuario, UsuarioController.criar);
app.put("/api/usuarios/:id", UsuarioController.atualizar);
app.delete("/api/usuarios/:id", UsuarioController.deletar);

export default app;