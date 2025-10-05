import express from "express";
import cors from "cors";
import { DadosController } from "./controllers/DadosController.js";
import { UsuarioController } from "./controllers/UsuarioController.js";
import { AuthController } from "./controllers/AuthController.js";
import { validarDados } from "./middlewares/validarDados.js";
import { autenticar } from "./middlewares/autenticar.js";

const app = express();

app.use(express.json());
app.use(cors());

// ===== ROTAS PÚBLICAS =====
app.post("/api/auth/login", AuthController.login);
app.post("/api/usuarios", UsuarioController.criar); // Registro de novos usuários


// Verificar token
app.get("/api/auth/verificar", autenticar, AuthController.verificarToken);

// Dados ESP32
app.get("/api/dados", autenticar, DadosController.listar);
app.get("/api/dados/ultimas", autenticar,DadosController.ultimasLeituras);
app.get("/api/dados/:dispositivoId", autenticar, DadosController.listarPorDispositivo);
app.post("/api/dados", validarDados, DadosController.criar); 

// Usuários
app.get("/api/usuarios", autenticar, UsuarioController.listar);
app.get("/api/usuarios/:id", autenticar, UsuarioController.buscarPorId);
app.put("/api/usuarios/:id", autenticar, UsuarioController.atualizar);
app.delete("/api/usuarios/:id", autenticar, UsuarioController.deletar);

export default app;