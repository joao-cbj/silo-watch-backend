# Sistema de Monitoramento com ESP32 e Backend Node.js

Este projeto consiste em um backend em **Node.js** com **MongoDB** para receber e armazenar dados de sensores enviados por dispositivos **ESP32** com DHT22. Ele inclui autenticação JWT, CRUD de usuários e endpoints para leituras e exportação de dados em CSV.

---

## Estrutura do Projeto

```
api/
├─ src/
│  ├─ config/
│  │  └─ database.js
│  ├─ controllers/
│  │  ├─ AuthController.js
│  │  ├─ DadosController.js
│  │  └─ UsuarioController.js
│  ├─ middlewares/
│  │  ├─ autenticar.js
│  │  ├─ validarDados.js
│  │  └─ validarUsuario.js
│  ├─ models/
│  │  ├─ Dados.js
│  │  └─ Usuario.js
│  ├─ repositories/
│  │  ├─ DadosRepository.js
│  │  └─ UsuarioRepository.js
│  ├─ services/
│  │  ├─ AuthService.js
│  │  ├─ DadosService.js
│  │  └─ UsuarioService.js
│  ├─ app.js
│  └─ server.js
esp32/
└─ esp32c3_SENSOR.ino
```

---

## ⚙️ Requisitos

- Node.js v18+
- MongoDB
- ESP32 com sensor DHT22

---

## 📝 Configuração do Backend

1. Clone o repositório:

```bash
git clone <URL_DO_REPOSITORIO>
cd api
```

2. Instale as dependências:

```bash
npm install
```

3. Crie um arquivo `.env` na raiz do backend com as variáveis:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/seu_banco
JWT_SECRET=sua_chave_secreta
```

4. Inicie o servidor:

```bash
npm run dev
```

O backend estará disponível em `http://localhost:3000`.

---

## Endpoints Principais

### Autenticação

| Método | Endpoint            | Descrição                        |
| ------ | ------------------- | -------------------------------- |
| POST   | /api/auth/login     | Login de usuário (email + senha) |
| GET    | /api/auth/verificar | Verifica token JWT               |

### Dados do ESP32

| Método | Endpoint                  | Descrição                                                 |
| ------ | ------------------------- | --------------------------------------------------------- |
| POST   | /api/dados                | Envia dados do sensor (temperatura, umidade, dispositivo) |
| GET    | /api/dados                | Lista leituras com filtros opcionais                      |
| GET    | /api/dados/ultimas        | Última leitura de cada dispositivo                        |
| GET    | /api/dados/:dispositivoId | Histórico por dispositivo                                 |
| GET    | /api/dados/exportar       | Exporta dados em CSV                                      |

### Usuários

| Método | Endpoint                | Descrição             |
| ------ | ----------------------- | --------------------- |
| POST   | /api/usuarios           | Criar novo usuário    |
| GET    | /api/usuarios           | Listar usuários       |
| GET    | /api/usuarios/:id       | Buscar usuário por ID |
| PUT    | /api/usuarios/:id       | Atualizar usuário     |
| DELETE | /api/usuarios/:id       | Deletar usuário       |
| PUT    | /api/usuarios/:id/senha | Alterar senha         |

> Todos os endpoints de usuários e dados exigem **token JWT**.

---

## Configuração do ESP32

1. Abra o arquivo `esp32c3_SENSOR.ino`.
2. Substitua as seguintes variáveis:

```cpp
#define WIFI_SSID "<SEU_SSID_AQUI>"
#define WIFI_PASS "<SUA_SENHA_AQUI>"
#define API_URL "<URL_DA_SUA_API_AQUI>"
#define DEVICE_NAME "ESP32_SILO_01"
```

3. Faça upload do código para o ESP32.

O dispositivo irá:

* Conectar ao WiFi.
* Ler temperatura e umidade do sensor DHT22.
* Enviar os dados para o backend a cada 30 segundos.
* Indicar status via LED embutido.

---

## Testes Básicos

1. **Testar conexão MongoDB**:

```bash
node
> import { conectarMongoDB } from "./src/config/database.js";
> conectarMongoDB();
```

2. **Testar backend** com `Postman` ou `Insomnia`:

   * POST `/api/auth/login` com `{ "email": "...", "senha": "..." }`.
   * POST `/api/dados` enviando JSON:

```json
{
  "temperatura": 25.5,
  "umidade": 60,
  "dispositivo": "ESP32_SILO_01"
}
```

* GET `/api/dados/ultimas` com header `Authorization: Bearer <TOKEN>`.

3. **Testar exportação CSV**:

   * GET `/api/dados/exportar?limite=100`.

---

## Segurança

* Senhas armazenadas com **bcrypt**.
* Autenticação via **JWT**.
* Validações básicas nos middlewares (`validarDados`, `validarUsuario`).

---

## Observações

* O ESP32 deve ter acesso à rede do backend.
* Ajuste o intervalo de envio no loop do ESP32 conforme necessidade.
* O backend suporta histórico, últimas leituras e exportação de CSV.