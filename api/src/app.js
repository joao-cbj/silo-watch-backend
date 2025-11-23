import express from "express";
import cors from "cors";
import { DadosController } from "./controllers/DadosController.js";
import { UsuarioController } from "./controllers/UsuarioController.js";
import { AuthController } from "./controllers/AuthController.js";
import { SiloController } from "./controllers/SiloController.js";
import { HybridProvisioningController } from './controllers/HybridProvisioningController.js';
import { validarDados } from "./middlewares/validarDados.js";
import { validarSilo, validarAtualizacaoSilo } from "./middlewares/validarSilo.js";
import { autenticar } from "./middlewares/autenticar.js";

const app = express();

app.use(express.json());
app.use(cors());

// ===== ROTAS PÚBLICAS =====
app.post("/api/auth/login", AuthController.login);

// Verificar token
app.get("/api/auth/verificar", autenticar, AuthController.verificarToken);

// ===== ROTAS DE PROVISIONAMENTO =====
app.post('/api/hybrid-provisioning/scan', autenticar, HybridProvisioningController.scan);
app.post('/api/hybrid-provisioning/provision', autenticar, HybridProvisioningController.provision);
app.get('/api/hybrid-provisioning/status', autenticar, HybridProvisioningController.status);
app.get('/api/hybrid-provisioning/comandos', autenticar, HybridProvisioningController.listarComandos);
app.delete('/api/hybrid-provisioning/limpar', autenticar, HybridProvisioningController.limparComandos);

// ===== ROTAS DE SILOS =====
app.get("/api/silos", autenticar, SiloController.listar);
app.get("/api/silos/:id", autenticar, SiloController.buscarPorId);
app.post("/api/silos", autenticar, validarSilo, SiloController.criar);
app.put("/api/silos/:id", autenticar, validarAtualizacaoSilo, SiloController.atualizar);
app.delete("/api/silos/:id", autenticar, SiloController.deletar);
// Endpoint para ESP32/Gateway (sem autenticação)
app.get("/api/silos/config/:dispositivo", SiloController.buscarConfiguracao);

// ===== ROTAS DE DADOS ESP32 =====
app.get("/api/dados/exportar", autenticar, DadosController.exportar);
app.get("/api/dados", autenticar, DadosController.listar);
app.get("/api/dados/ultimas", autenticar, DadosController.ultimasLeituras);
app.get("/api/dados/:dispositivoId", autenticar, DadosController.listarPorDispositivo);
app.post("/api/dados", validarDados, DadosController.criar); // Sem autenticação para ESP32

// ===== ROTAS DE USUÁRIOS =====
app.post("/api/usuarios", autenticar, UsuarioController.criar);
app.get("/api/usuarios", autenticar, UsuarioController.listar);
app.get("/api/usuarios/:id", autenticar, UsuarioController.buscarPorId);
app.put("/api/usuarios/:id", autenticar, UsuarioController.atualizar);
app.delete("/api/usuarios/:id", autenticar, UsuarioController.deletar);
app.put("/api/usuarios/:id/senha", autenticar, UsuarioController.alterarSenha);

export default app;