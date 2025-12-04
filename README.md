# SiloWatch - Sistema de Monitoramento Inteligente de Silos

Backend completo em **Node.js** com **MongoDB** e **MQTT** para monitoramento de silos através de dispositivos **ESP32** com sensores DHT22. Sistema integrado com provisionamento BLE, comunicação por ESP-NOW, autenticação JWT, MFA (autenticação de dois fatores) e controle de permissões.

---

## 📋 Visão Geral

O SiloWatch permite:
- Monitoramento em tempo real de temperatura e umidade de silos
- Provisionamento automático de dispositivos ESP32 via BLE através de gateway MQTT
- Autenticação segura com JWT e MFA (Microsoft Authenticator)
- Controle de acesso baseado em roles (Admin/Usuário)
- Exportação de dados históricos em CSV
- Gestão completa de silos e dispositivos

---

## 📂 Estrutura do Projeto

```
api/
├─ src/
│  ├─ config/
│  │  └─ database.js
│  ├─ controllers/
│  │  ├─ AuthController.js
│  │  ├─ DadosController.js
│  │  ├─ MFAController.js
│  │  ├─ MQTTProvisioningController.js
│  │  ├─ SiloController.js
│  │  └─ UsuarioController.js
│  ├─ middlewares/
│  │  ├─ autenticar.js
│  │  ├─ validarDados.js
│  │  ├─ validarSilo.js
│  │  ├─ validarUsuario.js
│  │  └─ verificarPermissao.js
│  ├─ models/
│  │  ├─ Dados.js
│  │  ├─ Silo.js
│  │  └─ Usuario.js
│  ├─ repositories/
│  │  ├─ DadosRepository.js
│  │  ├─ SiloRepository.js
│  │  └─ UsuarioRepository.js
│  ├─ services/
│  │  ├─ AuthService.js
│  │  ├─ DadosService.js
│  │  ├─ SiloService.js
│  │  └─ UsuarioService.js
│  ├─ app.js
│  └─ server.js
├─ .env
├─ package.json
└─ README.md
esp32/
```

---

## ⚙️ Requisitos

- **Node.js** v18+
- **MongoDB** (local ou MongoDB Atlas)
- **Broker MQTT** (EMQ X Cloud ou similar)
- **ESP32** com sensor DHT22 + botão para Reset manual
- **ESP32** sem sensor para provisionamento via BLE + botão para Reset manual

---

## 🚀 Configuração do Backend

### 1. Clone e instale dependências

```bash
git clone <URL_DO_REPOSITORIO>
cd api
npm install
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3000

# MongoDB
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/silowatch?retryWrites=true&w=majority

# Autenticação JWT
JWT_SECRET=sua_chave_secreta_super_segura

# MQTT Broker
MQTT_BROKER=mqtts://seu-broker.emqxsl.com:8883
MQTT_USER=seu_usuario_mqtt
MQTT_PASS=sua_senha_mqtt
```

### 3. Inicie o servidor

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`.

---

## 📡 API Endpoints

### 🔐 Autenticação

| Método | Endpoint                | Descrição                  | Auth |
|--------|------------------------|----------------------------|------|
| POST   | `/api/auth/login`      | Login (email + senha + MFA) | ❌   |
| GET    | `/api/auth/verificar`  | Verifica validade do token  | ✅   |

**Exemplo de Login:**
```json
POST /api/auth/login
{
  "email": "admin@silowatch.com",
  "senha": "senha123",
  "mfaCode": "123456"  // Opcional, só se MFA ativado
}
```

**Resposta:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "507f1f77bcf86cd799439011",
    "nome": "Admin",
    "email": "admin@silowatch.com",
    "role": "admin"
  }
}
```

---

### 🔒 MFA (Autenticação de Dois Fatores)

| Método | Endpoint                  | Descrição                          | Auth | Role    |
|--------|--------------------------|-------------------------------------|------|---------|
| GET    | `/api/auth/mfa/status`   | Verifica se MFA está ativado        | ✅   | Qualquer |
| POST   | `/api/auth/mfa/setup`    | Gera QR Code para Microsoft Auth    | ✅   | Qualquer |
| POST   | `/api/auth/mfa/verify`   | Verifica código e ativa MFA         | ✅   | Qualquer |
| POST   | `/api/auth/mfa/disable`  | Desativa MFA do usuário             | ✅   | Qualquer |

**Fluxo de ativação do MFA:**

1. **Configurar MFA:**
```json
POST /api/auth/mfa/setup
Headers: { "Authorization": "Bearer <token>" }

Resposta:
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "message": "QR Code gerado. Escaneie com Microsoft Authenticator"
}
```

2. **Verificar código:**
```json
POST /api/auth/mfa/verify
Headers: { "Authorization": "Bearer <token>" }
{
  "code": "123456"
}
```

3. **Login com MFA ativado:** Incluir `mfaCode` no login.

---

### 🏭 Silos

| Método | Endpoint                        | Descrição                          | Auth | Role    |
|--------|---------------------------------|-------------------------------------|------|---------|
| GET    | `/api/silos`                    | Listar todos os silos               | ✅   | Qualquer |
| GET    | `/api/silos/estatisticas`       | Estatísticas gerais dos silos       | ✅   | Qualquer |
| GET    | `/api/silos/:id`                | Buscar silo por ID                  | ✅   | Qualquer |
| GET    | `/api/silos/config/:dispositivo`| Buscar config por dispositivo (ESP32)| ❌   | -       |
| POST   | `/api/silos`                    | Criar novo silo                     | ✅   | Admin   |
| PUT    | `/api/silos/:id`                | Atualizar silo                      | ✅   | Admin   |
| DELETE | `/api/silos/:id`                | Deletar silo                        | ✅   | Admin   |

**Modelo de Silo:**
```json
{
  "nome": "Silo A - Superfície",
  "tipoSilo": "superficie",  // "superficie" | "trincheira" | "cilindrico" | "silo-bolsa"
  "dispositivo": "507f1f77bcf86cd799439011",  // ID do silo (usado como device ID)
  "macAddress": "AA:BB:CC:DD:EE:FF",  // Formato XX:XX:XX:XX:XX:XX
  "integrado": true,
  "criadoEm": "2024-12-04T10:00:00.000Z",
  "atualizadoEm": "2024-12-04T10:00:00.000Z"
}
```

**Tipos de Silo válidos:**
- `superficie` - Silo de superfície
- `trincheira` - Silo trincheira
- `cilindrico` - Silo cilíndrico
- `silo-bolsa` - Silo bolsa

**Estatísticas:**
```json
GET /api/silos/estatisticas

Resposta:
{
  "total": 5,
  "integrados": 3,
  "naoIntegrados": 2,
  "porTipo": {
    "superficie": 2,
    "cilindrico": 2,
    "trincheira": 1
  }
}
```

---

### 📶 MQTT Provisioning (BLE)

Sistema de provisionamento via Bluetooth Low Energy através de gateway MQTT.

| Método | Endpoint                             | Descrição                          | Auth | Role  |
|--------|-------------------------------------|-------------------------------------|------|-------|
| GET    | `/api/mqtt-provisioning/status`     | Verifica se gateway está online     | ✅   | Admin |
| POST   | `/api/mqtt-provisioning/scan`       | Escaneia dispositivos BLE           | ✅   | Admin |
| POST   | `/api/mqtt-provisioning/provision`  | Provisiona ESP32 via BLE            | ✅   | Admin |
| POST   | `/api/mqtt-provisioning/desintegrar`| Desintegra silo (apenas no banco)   | ✅   | Admin |
| GET    | `/api/mqtt-provisioning/info`       | Lista comandos disponíveis          | ✅   | Admin |

**Fluxo de Provisionamento:**

1. **Verificar gateway:**
```json
GET /api/mqtt-provisioning/status

Resposta:
{
  "success": true,
  "gateway": {
    "online": true,
    "method": "mqtt"
  }
}
```

2. **Escanear dispositivos BLE:**
```json
POST /api/mqtt-provisioning/scan

Resposta:
{
  "success": true,
  "dispositivos": [
    {
      "mac": "AA:BB:CC:DD:EE:FF",
      "nome": "ESP32_SILO",
      "rssi": -45
    }
  ],
  "total": 1
}
```

3. **Provisionar silo:**
```json
POST /api/mqtt-provisioning/provision
{
  "siloId": "507f1f77bcf86cd799439011",
  "macSilo": "AA:BB:CC:DD:EE:FF"
}

Resposta:
{
  "success": true,
  "message": "Silo provisionado com sucesso via BLE",
  "silo": {
    "id": "507f1f77bcf86cd799439011",
    "nome": "Silo A",
    "dispositivo": "507f1f77bcf86cd799439011",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "integrado": true
  }
}
```

4. **Desintegrar silo:**
```json
POST /api/mqtt-provisioning/desintegrar
{
  "siloId": "507f1f77bcf86cd799439011"
}

Nota: Apenas atualiza o banco. Para resetar o ESP32, pressione o botão por 3 segundos.
```

---

### 📊 Dados dos Sensores (ESP32)

| Método | Endpoint                          | Descrição                          | Auth | Role    |
|--------|----------------------------------|-------------------------------------|------|---------|
| POST   | `/api/dados`                     | Enviar dados do sensor (ESP32)      | ❌   | -       |
| GET    | `/api/dados`                     | Listar leituras com filtros         | ✅   | Qualquer |
| GET    | `/api/dados/ultimas`             | Última leitura de cada dispositivo  | ✅   | Qualquer |
| GET    | `/api/dados/historico/:dispositivo` | Histórico completo por dispositivo | ✅   | Qualquer |
| GET    | `/api/dados/:dispositivoId`      | Leituras de um dispositivo          | ✅   | Qualquer |
| GET    | `/api/dados/exportar`            | Exportar dados em CSV               | ✅   | Qualquer |
| DELETE | `/api/dados/:dispositivo`        | Deletar dados de um dispositivo     | ✅   | Admin   |

**Envio de dados pelo ESP32:**
```json
POST /api/dados
{
  "temperatura": 25.5,
  "umidade": 60.2,
  "dispositivo": "507f1f77bcf86cd799439011"  // ID do silo
}
```

**Últimas leituras:**
```json
GET /api/dados/ultimas

Resposta:
[
  {
    "dispositivo": "507f1f77bcf86cd799439011",
    "temperatura": 25.5,
    "umidade": 60.2,
    "timestamp": "2024-12-04T10:30:00.000Z",
    "silo": {
      "nome": "Silo A",
      "tipoSilo": "superficie"
    }
  }
]
```

**Exportar CSV:**
```
GET /api/dados/exportar?dispositivo=507f1f77bcf86cd799439011&limite=1000

Resposta: arquivo CSV com headers:
Dispositivo,Temperatura,Umidade,Data/Hora
```

---

### 👥 Usuários

| Método | Endpoint                   | Descrição                      | Auth | Role           |
|--------|---------------------------|--------------------------------|------|----------------|
| POST   | `/api/usuarios`           | Criar novo usuário             | ✅   | Admin          |
| GET    | `/api/usuarios`           | Listar todos os usuários       | ✅   | Admin          |
| GET    | `/api/usuarios/:id`       | Buscar usuário por ID          | ✅   | Admin ou Self  |
| PUT    | `/api/usuarios/:id`       | Atualizar usuário              | ✅   | Admin ou Self  |
| PUT    | `/api/usuarios/:id/senha` | Alterar senha                  | ✅   | Admin ou Self  |
| DELETE | `/api/usuarios/:id`       | Deletar usuário                | ✅   | Admin          |

**Modelo de Usuário:**
```json
{
  "nome": "João Silva",
  "email": "joao@silowatch.com",
  "senha": "senha123",
  "role": "operador",  // "admin" ou "operador"
  "mfaEnabled": false,
  "mfaSecret": null
}
```

---

## 🔒 Sistema de Permissões

### Roles disponíveis:
- **Admin**: Acesso total (CRUD silos, usuários, provisionamento, dados)
- **Operador**: Leitura de silos e dados, edição do próprio perfil

---

## 📦 Dependências Principais

```json
{
  "express": "^4.21.2",
  "mongoose": "^8.0.0",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^3.0.2",
  "mqtt": "^5.14.1",
  "speakeasy": "^2.0.0",
  "qrcode": "^1.5.4",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "json2csv": "^6.0.0-alpha.2"
}
```

---

## 🧪 Testes

### 1. Testar MongoDB
```bash
node
> import { conectarMongoDB } from "./src/config/database.js";
> conectarMongoDB();
```

### 2. Testar autenticação
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","senha":"senha123"}'

# Verificar token
curl http://localhost:3000/api/auth/verificar \
  -H "Authorization: Bearer <seu_token>"
```

### 3. Testar MFA
```bash
# Setup MFA
curl -X POST http://localhost:3000/api/auth/mfa/setup \
  -H "Authorization: Bearer <token>"

# Verificar código
curl -X POST http://localhost:3000/api/auth/mfa/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

### 4. Testar Gateway MQTT
```bash
# Status
curl http://localhost:3000/api/mqtt-provisioning/status \
  -H "Authorization: Bearer <token_admin>"

# Scan BLE
curl -X POST http://localhost:3000/api/mqtt-provisioning/scan \
  -H "Authorization: Bearer <token_admin>"
```

### 5. Testar envio de dados (simular ESP32)
```bash
curl -X POST http://localhost:3000/api/dados \
  -H "Content-Type: application/json" \
  -d '{
    "temperatura": 25.5,
    "umidade": 60,
    "dispositivo": "507f1f77bcf86cd799439011"
  }'
```

---

