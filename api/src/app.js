import express from "express";
import cors from "cors";
import { DadosController } from "./controllers/DadosController.js";
import { UsuarioController } from "./controllers/UsuarioController.js";
import { AuthController } from "./controllers/AuthController.js";
import { SiloController } from "./controllers/SiloController.js";
import { MQTTProvisioningController } from './controllers/MQTTProvisioningController.js';
import { validarDados } from "./middlewares/validarDados.js";
import { validarSilo, validarAtualizacaoSilo } from "./middlewares/validarSilo.js";
import { MFAController } from './controllers/MFAController.js';
import { autenticar } from "./middlewares/autenticar.js";
import { verificarAdmin, verificarGerenciarUsuario } from "./middlewares/verificarPermissao.js";

const app = express();

app.use(express.json());
app.use(cors());

// ===== ROTAS PÚBLICAS =====
app.post("/api/auth/login", AuthController.login);

// Verificar token
app.get("/api/auth/verificar", autenticar, AuthController.verificarToken);

// ===== ROTAS MQTT PROVISIONING (Apenas Admin) =====
app.get('/api/mqtt-provisioning/status', autenticar, verificarAdmin, MQTTProvisioningController.status);
app.post('/api/mqtt-provisioning/scan', autenticar, verificarAdmin, MQTTProvisioningController.scan);
app.post('/api/mqtt-provisioning/provision', autenticar, verificarAdmin, MQTTProvisioningController.provision);
app.post('/api/mqtt-provisioning/desintegrar', autenticar, verificarAdmin, MQTTProvisioningController.desintegrar); 
app.get('/api/mqtt-provisioning/info', autenticar, verificarAdmin, MQTTProvisioningController.listarComandos);

// ===== ROTAS DE SILOS =====
// IMPORTANTE: Rota específica ANTES da rota com parâmetro
app.get("/api/silos/estatisticas", autenticar, SiloController.estatisticas);
app.get("/api/silos/config/:dispositivo", SiloController.buscarConfiguracao); // Sem autenticação para ESP32
app.get("/api/silos", autenticar, SiloController.listar);
app.get("/api/silos/:id", autenticar, SiloController.buscarPorId);

// Admin pode criar, atualizar e deletar silos
app.post("/api/silos", autenticar, verificarAdmin, validarSilo, SiloController.criar);
app.put("/api/silos/:id", autenticar, verificarAdmin, validarAtualizacaoSilo, SiloController.atualizar);
app.delete("/api/silos/:id", autenticar, verificarAdmin, SiloController.deletar);

// ===== ROTAS DE DADOS ESP32 =====
app.get("/api/dados/exportar", autenticar, DadosController.exportar);
app.get("/api/dados/ultimas", autenticar, DadosController.ultimasLeituras);
app.get("/api/dados/historico/:dispositivo", autenticar, DadosController.buscarHistorico);
app.get("/api/dados", autenticar, DadosController.listar);
app.get("/api/dados/:dispositivoId", autenticar, DadosController.listarPorDispositivo);
app.post("/api/dados", validarDados, DadosController.criar); // Sem autenticação para ESP32

// Apenas admin pode deletar dados
app.delete("/api/dados/:dispositivo", autenticar, verificarAdmin, DadosController.deletarPorDispositivo);

// ===== ROTAS MFA (Qualquer usuário autenticado) =====
app.get('/api/auth/mfa/status', autenticar, MFAController.status);
app.post('/api/auth/mfa/setup', autenticar, MFAController.setup);
app.post('/api/auth/mfa/verify', autenticar, MFAController.verify);
app.post('/api/auth/mfa/disable', autenticar, MFAController.disable);

// ===== ROTAS DE USUÁRIOS =====
// Apenas admin pode criar e listar usuários
app.post("/api/usuarios", autenticar, verificarAdmin, UsuarioController.criar);
app.get("/api/usuarios", autenticar, verificarAdmin, UsuarioController.listar);

// Admin e o próprio usuário podem acessar perfil
app.get("/api/usuarios/:id", autenticar, verificarGerenciarUsuario, UsuarioController.buscarPorId);
app.put("/api/usuarios/:id", autenticar, verificarGerenciarUsuario, UsuarioController.atualizar);
app.put("/api/usuarios/:id/senha", autenticar, verificarGerenciarUsuario, UsuarioController.alterarSenha);

// Apenas admin pode deletar usuários
app.delete("/api/usuarios/:id", autenticar, verificarAdmin, UsuarioController.deletar);

export default app;