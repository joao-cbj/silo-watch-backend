# SiloWatch IoT - Sistema Completo

## 📋 Descrição do Sistema

Sistema IoT completo para monitoramento de silos, composto por:

- **ESP32 Gateway**: Gerencia comunicação entre sensores e nuvem via MQTT/REST API
- **ESP32 Silo**: Monitora temperatura e umidade, enviando dados via ESP-NOW

---

## 🔧 Requisitos de Hardware

### ESP32 Gateway
- **ESP32 DevKit V1** ou similar
- **LED** conectado ao pino GPIO 8
- **Botão de Reset** conectado ao GPIO 0 (GND quando pressionado)

### ESP32 Silo
- **ESP32 DevKit V1** ou similar
- **Sensor DHT22** (temperatura e umidade)
  - VCC → 3.3V
  - GND → GND
  - DATA → GPIO 4
- **LED** conectado ao pino GPIO 8
- **Botão de Reset** conectado ao GPIO 1 (GND quando pressionado)

---

## 📚 Bibliotecas Necessárias

Instale as seguintes bibliotecas através do **Gerenciador de Bibliotecas** do Arduino IDE (`Sketch → Incluir Biblioteca → Gerenciar Bibliotecas`):

### Comum para Gateway e Silo:
1. **WiFi** (incluída no core ESP32)
2. **Preferences** (incluída no core ESP32)
3. **ESP32 BLE Arduino** (incluída no core ESP32)
4. **ArduinoJson** by Benoit Blanchon (versão 6.x)

### Específico do Gateway:
5. **WebServer** (incluída no core ESP32)
6. **PubSubClient** by Nick O'Leary
7. **HTTPClient** (incluída no core ESP32)

### Específico do Silo:
8. **ESP-NOW** (incluída no core ESP32)
9. **DHT sensor library** by Adafruit
10. **Adafruit Unified Sensor** by Adafruit

---

## ⚙️ Configuração do Arduino IDE

### 1. Instalar Suporte ESP32

1. Abra o Arduino IDE
2. Vá em **Arquivo → Preferências**
3. Em "URLs Adicionais para Gerenciadores de Placas", adicione:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Vá em **Ferramentas → Placa → Gerenciador de Placas**
5. Procure por "esp32" e instale **esp32 by Espressif Systems**

### 2. Configurações da Placa

**Ferramentas → Placa:**
- Selecione: **ESP32 Dev Module**

**Ferramentas → Configurações:**
```
Upload Speed: 921600
CPU Frequency: 240MHz
Flash Frequency: 80MHz
Flash Mode: QIO
Flash Size: 4MB (32Mb)
Partition Scheme: No OTA (2MB APP/2MB SPIFFS)  ⚠️ CRÍTICO
Core Debug Level: None
PSRAM: Disabled
```

> ⚠️ **IMPORTANTE:** A configuração **Partition Scheme: No OTA** é **obrigatória** para ambos os dispositivos!

### 3. Configurar Porta Serial

#### 🐧 **Linux:**

```bash
# Verificar portas disponíveis
ls /dev/ttyUSB*
# ou
ls /dev/ttyACM*

# Dar permissão de acesso (se necessário)
sudo chmod 666 /dev/ttyUSB0

# OU adicionar usuário ao grupo dialout (recomendado)
sudo usermod -a -G dialout $USER
# (requer logout/login para aplicar)
```

**No Arduino IDE:**
- **Ferramentas → Porta:** `/dev/ttyUSB0` ou `/dev/ttyACM0`

#### 🪟 **Windows:**

1. Conecte o ESP32 via USB
2. Abra o **Gerenciador de Dispositivos** (Win+X → Gerenciador de Dispositivos)
3. Localize a porta em **Portas (COM & LPT)**
4. Anote o número da porta (ex: COM3)

**No Arduino IDE:**
- **Ferramentas → Porta:** `COM3`, `COM4`, etc.

> **Nota:** Se a porta não aparecer no Windows, instale o driver:
> - **CH340**: [Download](http://www.wch.cn/downloads/CH341SER_ZIP.html)
> - **CP2102**: [Download](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)

---

## 🚀 Guia de Instalação

### 📡 ESP32 Gateway

#### 1. Upload do Firmware
1. Abra o arquivo `gateway.ino` no Arduino IDE
2. Selecione a placa e porta correta
3. Verifique se **Partition Scheme** está em **No OTA**
4. Clique em **Upload** (Ctrl+U)

#### 2. Primeiro Boot - Modo Setup
Na primeira inicialização:

1. O LED piscará **3 vezes** (300ms) - Modo Setup ativo
2. O Gateway criará uma rede WiFi: `Gateway_XXXXXX`
3. Conecte-se a essa rede com seu dispositivo móvel
4. Acesse `http://192.168.4.1` no navegador
5. Configure:
   - **SSID**: Nome da sua rede WiFi
   - **Senha**: Senha da rede WiFi
6. Clique em "Salvar e Conectar"
7. Aguarde o reinício automático

#### 3. Modo Normal - Operação
Após configurado com sucesso:

1. LED piscará **2 vezes** (300ms) - WiFi conectado
2. LED piscará **3 vezes** (300ms) - ESP-NOW iniciado
3. LED piscará **4 vezes** (300ms) - MQTT conectado
4. Gateway está **operacional**!

---

### 🌡️ ESP32 Silo

#### 1. Montagem do Hardware

**Conexões do DHT22:**
```
DHT22 VCC  → ESP32 3.3V
DHT22 GND  → ESP32 GND
DHT22 DATA → ESP32 GPIO 4
```

**Botão de Reset:**
```
Botão → GPIO 1 e GND
(conecta GPIO 1 ao GND quando pressionado)
```

#### 2. Upload do Firmware
1. Abra o arquivo `silo.ino` no Arduino IDE
2. Selecione a placa e porta correta
3. Verifique se **Partition Scheme** está em **No OTA**
4. Clique em **Upload** (Ctrl+U)

#### 3. Primeiro Boot - Modo Setup
Na primeira inicialização:

1. O LED piscará **3 vezes** (300ms) - Modo Setup ativo
2. O Silo criará um serviço BLE: `SILO_XXXXXX`
3. Aguarde o provisionamento via Gateway

#### 4. Provisionamento
O provisionamento é **automático** via Backend → Gateway → Silo:

1. Backend detecta novo dispositivo via Gateway scan
2. Usuário configura nome e ID no sistema web
3. Backend envia comando de provisionamento ao Gateway
4. Gateway conecta ao Silo via BLE
5. Transmite configurações:
   - Nome do silo
   - ID do silo  
   - MAC do Gateway
   - Canal WiFi
6. Silo salva e reinicia automaticamente

#### 5. Modo Normal - Operação
Após provisionado:

1. LED piscará **4 vezes** (200ms) - Modo Normal ativo
2. Silo envia dados a cada **30 segundos**
3. LED pisca **1 vez** curta a cada envio bem-sucedido
4. LED pisca **3 vezes** (300ms) se envio falhar

---

## 📊 Comunicação do Sistema

### Gateway → Nuvem

**MQTT:**
- **Broker:** SUA-URL-BROKER.com
- **Porta:** 8883 (TLS)
- **Tópico de inscrição:** `gateway/comando`
- **Tópicos de publicação:**
  - `gateway/resposta/pong`
  - `gateway/resposta/scan`
  - `gateway/resposta/provision`

**API REST:**
- **Endpoint:** https://SUA-API-BACKEND.com/api/dados
- **Método:** POST
- **Content-Type:** application/json

### Silo → Gateway

**ESP-NOW:**
- Envio a cada 30 segundos
- Estrutura de dados:
```json
{
  "dispositivo": "Silo 01",
  "temperatura": 25.5,
  "umidade": 65.2,
  "timestamp": 123456789
}
```

---

## 🔄 Comandos MQTT (Gateway)

### Ping
```json
{
  "acao": "ping",
  "id": "cmd_123456"
}
```

### Scan BLE
```json
{
  "acao": "scan",
  "id": "cmd_123457"
}
```

**Resposta:**
```json
{
  "id": "cmd_123457",
  "dispositivos": [
    {
      "nome": "SILO_ABC123",
      "mac": "AA:BB:CC:DD:EE:FF",
      "rssi": -65
    }
  ]
}
```

### Provisionar Silo
```json
{
  "acao": "provisionar",
  "id": "cmd_123458",
  "macSilo": "AA:BB:CC:DD:EE:FF",
  "siloNome": "Silo 01",
  "siloId": "silo_001"
}
```

---

## 🔴 Reset Manual

### Gateway (GPIO 0)
1. **Pressione e segure** o botão no **GPIO 0** por **3 segundos**
2. LED piscará **5 vezes** rapidamente
3. Gateway apaga configurações WiFi e reinicia em **Modo Setup**

### Silo (GPIO 1)
1. **Pressione e segure** o botão no **GPIO 1** por **3 segundos**
2. LED piscará **5 vezes** rapidamente
3. Silo apaga configurações e reinicia em **Modo Setup**
4. Será necessário provisionar novamente

---

## 📊 Feedback Visual (LED)

### Gateway

| Padrão | Significado |
|--------|-------------|
| 1 piscada longa (500ms) | Sistema iniciando |
| 3 piscadas (300ms) | Modo Setup ativo (WiFi AP) |
| 2 piscadas (300ms) | WiFi conectado |
| 3 piscadas (300ms) | ESP-NOW iniciado |
| 4 piscadas (300ms) | MQTT conectado |
| 6 piscadas (200ms) | MQTT desconectado |
| 1 piscada curta (50ms) | Dado recebido via ESP-NOW |
| 4 piscadas (100ms) | Escaneando BLE |
| 5 piscadas (100ms) | Provisionando via BLE |
| 5 piscadas rápidas (100ms) | Reset acionado |

### Silo

| Padrão | Significado |
|--------|-------------|
| 1 piscada longa (300ms) | Sistema iniciando |
| 3 piscadas (300ms) | Modo Setup (BLE ativo) |
| 2 piscadas (100ms) | Cliente BLE conectado |
| 5 piscadas (200ms) | Provisionamento bem-sucedido |
| 4 piscadas (200ms) | Modo Normal ativo |
| 1 piscada curta (50ms) | Envio de dados bem-sucedido |
| 3 piscadas (300ms) | Falha no envio de dados |
| 5 piscadas rápidas (100ms) | Reset acionado |

---

## 🐛 Troubleshooting

### Problemas Comuns - Gateway

#### ❌ Não conecta no WiFi
- Verifique SSID e senha
- Certifique-se que a rede é 2.4GHz (ESP32 não suporta 5GHz)
- Faça reset manual (GPIO 0 por 3s)

#### ❌ MQTT desconectado
- Verifique conexão com internet
- Confirme credenciais MQTT
- Aguarde reconexão automática (30s)

#### ❌ Não recebe dados dos silos
- Verifique se ESP-NOW foi iniciado (3 piscadas)
- Certifique-se que silos estão provisionados
- Verifique distância (máx. 200m em área aberta)

### Problemas Comuns - Silo

#### ❌ Sensor DHT22 retorna NaN
- Verifique conexões (VCC, GND, DATA no GPIO 4)
- Aguarde 2 segundos após ligar
- Teste com outro sensor DHT22
- Verifique se não há curto-circuito

#### ❌ Não aparece no scan BLE
- Verifique se está em Modo Setup (LED pisca 3x)
- Faça reset manual (GPIO 1 por 3s)
- Aproxime Gateway (máx. 10m para BLE)
- Aguarde 5 segundos após ligar

#### ❌ Dados não chegam ao Gateway
- Confirme que provisionamento foi bem-sucedido
- Verifique distância do Gateway
- Certifique-se que Gateway está operacional
- Reinicie ambos os dispositivos

### Problemas de Compilação

#### ❌ Erro "Partition too large"
**Solução:**
- Vá em **Ferramentas → Partition Scheme**
- Selecione **No OTA (2MB APP/2MB SPIFFS)**
- Compile novamente

#### ❌ Bibliotecas não encontradas
**Solução:**
- Abra **Gerenciador de Bibliotecas**
- Instale todas as bibliotecas listadas na seção de requisitos
- Reinicie o Arduino IDE

### Problemas de Porta Serial

#### ❌ Porta não aparece (Linux)
```bash
sudo chmod 666 /dev/ttyUSB0
# ou
sudo usermod -a -G dialout $USER
# (requer logout/login)
```

#### ❌ Porta não aparece (Windows)
- Instale driver CH340 ou CP2102
- Verifique no Gerenciador de Dispositivos
- Teste com outro cabo USB

#### ❌ Erro ao fazer upload
- Pressione e segure o botão BOOT durante upload
- Verifique se a porta correta está selecionada
- Reduza Upload Speed para 115200

---

## 🔧 Especificações Técnicas

### ESP32 Gateway
- **Protocolo WiFi:** 802.11 b/g/n (2.4GHz)
- **ESP-NOW:** Receptor de dados
- **BLE:** Client (para provisionamento de silos)
- **Servidor Web:** Porta 80 (modo Setup)
- **Alimentação:** 5V via USB / 3.3V regulado
- **Consumo típico:** ~80mA (idle) / ~240mA (WiFi ativo)

### ESP32 Silo
- **ESP-NOW:** Transmissor de dados (30s)
- **BLE:** Server (modo Setup)
- **Canal WiFi:** Configurado via provisionamento
- **DHT22:** GPIO 4
  - Faixa temperatura: -40°C a 80°C
  - Faixa umidade: 0% a 100%
  - Precisão: ±0.5°C / ±2% UR
- **Alimentação:** 5V via USB / 3.3V regulado
- **Consumo típico:** ~80mA (idle) / ~150mA (transmitindo)

---

## 📝 Notas Importantes

### ⚠️ CRÍTICO
- **Partition Scheme DEVE ser "No OTA"** em ambos os dispositivos
- Gateway e Silo devem estar no **mesmo canal WiFi** (configurado automaticamente)
- O **pino do botão é diferente**: Gateway usa GPIO 0, Silo usa GPIO 1
- Não desconecte DHT22 com sistema ligado
- Use fonte estável de pelo menos **500mA**

### ✅ Boas Práticas
- Use cabos USB de qualidade (máx. 1.5m)
- Mantenha ESP32 em local ventilado
- Para testes, mantenha Gateway e Silo próximos (< 10m)
- Em produção, ESP-NOW alcança até 200m em área aberta
- Proteja o sensor DHT22 de exposição direta ao sol
- Evite ambientes com umidade > 90% sem proteção adicional

### 🔋 Alimentação
- **Tensão:** 3.3V - 5V DC
- **Consumo Gateway:** 80-240mA
- **Consumo Silo:** 80-150mA
- **Recomendação:** Fonte 5V / 1A mínimo por dispositivo

### 🔐 Segurança
- Credenciais armazenadas em flash protegida (Preferences)
- BLE sem criptografia (apenas provisionamento local)
- ESP-NOW sem criptografia (rede local)
- MQTT com TLS (porta 8883)
- Para ambientes críticos, implemente criptografia customizada


---