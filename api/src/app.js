import express from "express";
import cors from "cors";
import { DadosController } from "./controllers/DadosController.js";
import { UsuarioController } from "./controllers/UsuarioController.js";
import { AuthController } from "./controllers/AuthController.js";
import { SiloController } from "./controllers/SiloController.js";
import { MQTTProvisioningController } from './controllers/MQTTProvisioningController.js';
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

// ===== ROTAS MQTT PROVISIONING =====
app.get('/api/mqtt-provisioning/status', autenticar, MQTTProvisioningController.status);
app.post('/api/mqtt-provisioning/scan', autenticar, MQTTProvisioningController.scan);
app.post('/api/mqtt-provisioning/provision', autenticar, MQTTProvisioningController.provision);
app.post('/api/mqtt-provisioning/desintegrar', autenticar, MQTTProvisioningController.desintegrar); // ✨ NOVA
app.post('/api/mqtt-provisioning/atualizar-nome', autenticar, MQTTProvisioningController.atualizarNome); // ✨ NOVA
app.get('/api/mqtt-provisioning/info', autenticar, MQTTProvisioningController.listarComandos);

// ===== ROTAS DE SILOS =====
// IMPORTANTE: Rota específica ANTES da rota com parâmetro
app.get("/api/silos/estatisticas", autenticar, SiloController.estatisticas);
app.get("/api/silos/config/:dispositivo", SiloController.buscarConfiguracao); // Sem autenticação para ESP32

app.get("/api/silos", autenticar, SiloController.listar);
app.get("/api/silos/:id", autenticar, SiloController.buscarPorId);
app.post("/api/silos", autenticar, validarSilo, SiloController.criar);
app.put("/api/silos/:id", autenticar, validarAtualizacaoSilo, SiloController.atualizar); // ✨ ATUALIZADA (envia comando ESP32)
app.delete("/api/silos/:id", autenticar, SiloController.deletar); // ✨ ATUALIZADA (envia comando reset)

// ===== ROTAS DE DADOS ESP32 =====
app.get("/api/dados/exportar", autenticar, DadosController.exportar);
app.get("/api/dados/ultimas", autenticar, DadosController.ultimasLeituras);
app.get("/api/dados/historico/:dispositivo", autenticar, DadosController.buscarHistorico);
app.get("/api/dados", autenticar, DadosController.listar);
app.get("/api/dados/:dispositivoId", autenticar, DadosController.listarPorDispositivo);
app.post("/api/dados", validarDados, DadosController.criar); // Sem autenticação para ESP32
app.delete("/api/dados/:dispositivo", autenticar, DadosController.deletarPorDispositivo);

// ===== ROTAS DE USUÁRIOS =====
app.post("/api/usuarios", autenticar, UsuarioController.criar);
app.get("/api/usuarios", autenticar, UsuarioController.listar);
app.get("/api/usuarios/:id", autenticar, UsuarioController.buscarPorId);
app.put("/api/usuarios/:id", autenticar, UsuarioController.atualizar);
app.delete("/api/usuarios/:id", autenticar, UsuarioController.deletar);
app.put("/api/usuarios/:id/senha", autenticar, UsuarioController.alterarSenha);

export default app;