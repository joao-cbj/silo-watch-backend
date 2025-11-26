#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <HTTPClient.h>
#include <Preferences.h>

extern "C" {
  #include "esp_wifi.h"
}

#define MQTT_BROKER "MQTT-URL"
#define MQTT_PORT 8883
#define MQTT_USER "USER-MQTT"
#define MQTT_PASS "PASSWORD-MQTT"
#define API_URL "URL-API"

#define LED 8
#define MAX_FILA 3
#define BUTTON_PIN 0

// ===== ESTRUTURAS ESP-NOW =====
struct Dado {
  char d[32];
  float t;
  float u;
  unsigned long ts;
};

// ✨ NOVO: Estrutura para comandos ESP-NOW (Gateway → Silo)
struct Comando {
  char tipo[16];        // "reset", "update_name"
  char dispositivo[32]; // dispositivo alvo
  char novoNome[32];    // novo nome (apenas para update_name)
  unsigned long ts;
};

// ✨ NOVO: Estrutura para respostas ESP-NOW (Silo → Gateway)
struct Resposta {
  char dispositivo[32];
  char status[16];    // "ok", "erro"
  char tipo[16];      // tipo do comando
  unsigned long ts;
};

// ===== VARIÁVEIS GLOBAIS =====
WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);
WebServer server(80);
Preferences preferences;

BLEScan* scan = nullptr;
BLEClient* client = nullptr;

uint8_t wifiChannel = 1;

String wifiSSID = "";
String wifiPassword = "";
bool wifiConfigurado = false;

enum Modo { MODO_SETUP, MODO_NORMAL };
Modo modoAtual = MODO_SETUP;

Dado fila[MAX_FILA];
bool env[MAX_FILA];
uint8_t idx = 0, cnt = 0;
unsigned long lastS = 0;
String lastCmdId = "";

// ✨ NOVO: Mapa de dispositivos (nome → MAC address)
struct DispositivoInfo {
  char nome[32];
  uint8_t mac[6];
  bool ativo;
};

DispositivoInfo dispositivos[10]; // Até 10 silos
int totalDispositivos = 0;

// ===== FUNÇÕES AUXILIARES =====
void blink(int n, int ms = 200) {
  for (int i = 0; i < n; i++) {
    digitalWrite(LED, HIGH);
    delay(ms);
    digitalWrite(LED, LOW);
    delay(ms);
  }
}

void salvarConfigWiFi() {
  preferences.begin("gateway", false);
  preferences.putString("ssid", wifiSSID);
  preferences.putString("password", wifiPassword);
  preferences.putBool("configured", true);
  preferences.end();
  
  Serial.println("✓ Configuração WiFi salva");
}

bool carregarConfigWiFi() {
  preferences.begin("gateway", true);
  wifiConfigurado = preferences.getBool("configured", false);
  
  if (wifiConfigurado) {
    wifiSSID = preferences.getString("ssid", "");
    wifiPassword = preferences.getString("password", "");
    
    Serial.println("✓ Config WiFi carregada");
    Serial.println("SSID: " + wifiSSID);
  }
  
  preferences.end();
  return wifiConfigurado;
}

void resetarConfigWiFi() {
  preferences.begin("gateway", false);
  preferences.clear();
  preferences.end();
  
  Serial.println("✓ Config WiFi resetada");
  blink(10, 100);
  ESP.restart();
}

// ✨ NOVO: Registra dispositivo no mapa
void registrarDispositivo(const char* nome, const uint8_t* mac) {
  // Verifica se já existe
  for (int i = 0; i < totalDispositivos; i++) {
    if (strcmp(dispositivos[i].nome, nome) == 0) {
      memcpy(dispositivos[i].mac, mac, 6);
      dispositivos[i].ativo = true;
      Serial.printf("✓ Dispositivo atualizado: %s\n", nome);
      return;
    }
  }
  
  // Adiciona novo
  if (totalDispositivos < 10) {
    strncpy(dispositivos[totalDispositivos].nome, nome, 32);
    memcpy(dispositivos[totalDispositivos].mac, mac, 6);
    dispositivos[totalDispositivos].ativo = true;
    totalDispositivos++;
    Serial.printf("✓ Dispositivo registrado: %s\n", nome);
  }
}

// ✨ NOVO: Busca MAC por nome de dispositivo
bool buscarMACPorNome(const char* nome, uint8_t* mac) {
  for (int i = 0; i < totalDispositivos; i++) {
    if (strcmp(dispositivos[i].nome, nome) == 0 && dispositivos[i].ativo) {
      memcpy(mac, dispositivos[i].mac, 6);
      return true;
    }
  }
  return false;
}

// ===== HTML DO WEB SERVER =====
const char* htmlPage = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gateway - Configuração WiFi</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      width: 100%;
    }
    h1 {
      color: #667eea;
      text-align: center;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 12px 15px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 16px;
      transition: all 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
      margin-top: 10px;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    .info-box {
      background: #f0f4ff;
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }
    .info-box p {
      color: #555;
      font-size: 13px;
      line-height: 1.6;
    }
    .status {
      text-align: center;
      margin-top: 20px;
      padding: 10px;
      border-radius: 10px;
      display: none;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 Gateway IoT</h1>
    <p class="subtitle">Configuração de Rede WiFi</p>
    
    <div class="info-box">
      <p><strong>📡 MAC Address:</strong><br><span id="macAddress">Carregando...</span></p>
    </div>
    
    <form id="wifiForm">
      <div class="form-group">
        <label for="ssid">Nome da Rede (SSID)</label>
        <input type="text" id="ssid" name="ssid" placeholder="Digite o SSID" required>
      </div>
      
      <div class="form-group">
        <label for="password">Senha do WiFi</label>
        <input type="password" id="password" name="password" placeholder="Digite a senha" required>
      </div>
      
      <button type="submit" class="btn">💾 Salvar e Conectar</button>
    </form>
    
    <div class="status" id="status"></div>
  </div>

  <script>
    fetch('/mac').then(r => r.text()).then(mac => {
      document.getElementById('macAddress').textContent = mac;
    });

    document.getElementById('wifiForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const ssid = document.getElementById('ssid').value;
      const password = document.getElementById('password').value;
      const statusDiv = document.getElementById('status');
      
      try {
        await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(password)}`
        });
        
        statusDiv.className = 'status success';
        statusDiv.textContent = '✓ Salvo! Gateway reiniciando...';
        statusDiv.style.display = 'block';
      } catch (error) {
        alert('Erro ao salvar');
      }
    });
  </script>
</body>
</html>
)rawliteral";

void handleRoot() { server.send(200, "text/html", htmlPage); }
void handleMAC() { server.send(200, "text/plain", WiFi.macAddress()); }

void handleSave() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    wifiSSID = server.arg("ssid");
    wifiPassword = server.arg("password");
    
    salvarConfigWiFi();
    server.send(200, "text/plain", "OK");
    
    blink(5, 200);
    delay(1000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "Parametros invalidos");
  }
}

// ===== MODO SETUP =====
void iniciarModoSetup() {
  Serial.println("\n=== MODO SETUP (WEB SERVER) ===");
  
  String apName = "Gateway_" + WiFi.macAddress().substring(9);
  apName.replace(":", "");
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str());
  
  IPAddress IP = WiFi.softAPIP();
  
  Serial.println("✓ Access Point ativo");
  Serial.println("Nome: " + apName);
  Serial.println("IP: " + IP.toString());
  
  server.on("/", handleRoot);
  server.on("/mac", handleMAC);
  server.on("/save", HTTP_POST, handleSave);
  server.begin();
  
  Serial.println("✓ Web Server na porta 80");
  Serial.println("Acesse: http://" + IP.toString());
  
  blink(3, 300);
}

// ===== ESP-NOW CALLBACKS =====
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *data, int len) {
  // Verifica se é Resposta ou Dado
  if (len == sizeof(Resposta)) {
    // ✨ NOVO: Recebeu resposta de comando
    Resposta* resp = (Resposta*)data;
    
    Serial.println("\n=== ESP-NOW: Resposta de Comando ===");
    Serial.printf("Dispositivo: %s\n", resp->dispositivo);
    Serial.printf("Tipo: %s\n", resp->tipo);
    Serial.printf("Status: %s\n", resp->status);
    
    // Publica resposta no MQTT
    String topico = "gateway/resposta/" + String(resp->tipo);
    String payload = "{\"id\":\"cmd_" + String(resp->ts) + "\",\"status\":\"" + String(resp->status) + "\",\"dispositivo\":\"" + String(resp->dispositivo) + "\"}";
    mqtt.publish(topico.c_str(), payload.c_str());
    
    blink(2, 100);
    return;
  }
  
  if (len == sizeof(Dado)) {
    // Dados de telemetria
    Serial.println("\n=== ESP-NOW: Dados Recebidos ===");
    Serial.printf("De: %02X:%02X:%02X:%02X:%02X:%02X\n",
                  info->src_addr[0], info->src_addr[1], info->src_addr[2],
                  info->src_addr[3], info->src_addr[4], info->src_addr[5]);
    
    if (cnt >= MAX_FILA) {
      Serial.println("✗ Fila cheia!");
      return;
    }
    
    memcpy(&fila[idx], data, sizeof(Dado));
    env[idx] = false;
    
    Dado* d = &fila[idx];
    Serial.printf("Dispositivo: %s\n", d->d);
    Serial.printf("Temperatura: %.2f °C\n", d->t);
    Serial.printf("Umidade: %.2f %%\n", d->u);
    
    // ✨ NOVO: Registra dispositivo no mapa
    registrarDispositivo(d->d, info->src_addr);
    
    idx = (idx + 1) % MAX_FILA;
    cnt++;
    
    blink(1, 50);
  }
}

// ===== API =====
void sendAPI(Dado* d) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient h;
  h.begin(API_URL);
  h.addHeader("Content-Type", "application/json");
  
  char buffer[150];
  snprintf(buffer, 150, "{\"temperatura\":%.2f,\"umidade\":%.2f,\"dispositivo\":\"%s\"}", 
           d->t, d->u, d->d);
  
  Serial.println("\n--- Enviando para API ---");
  Serial.println(buffer);
  
  int httpCode = h.POST((uint8_t*)buffer, strlen(buffer));
  
  if (httpCode > 0) {
    Serial.printf("✓ API Response: %d\n", httpCode);
  } else {
    Serial.printf("✗ Erro API\n");
  }
  
  h.end();
}

void procQ() {
  if (cnt == 0 || millis() - lastS < 5000) return;
  lastS = millis();
  
  for (int i = 0; i < MAX_FILA; i++) {
    if (cnt == 0) break;
    int id = (idx - cnt + MAX_FILA) % MAX_FILA;
    if (!env[id]) {
      sendAPI(&fila[id]);
      env[id] = true;
      cnt--;
      break;
    }
  }
}

// ===== BLE =====
class CB : public BLEAdvertisedDeviceCallbacks {
  public:
    String result = "[";
    int count = 0;
    
    void onResult(BLEAdvertisedDevice d) {
      String name = String(d.getName().c_str());
      if (name.startsWith("SILO_")) {
        if (count > 0) result += ",";
        result += "{\"nome\":\"" + name + "\",";
        result += "\"mac\":\"" + d.getAddress().toString() + "\",";
        result += "\"rssi\":" + String(d.getRSSI()) + "}";
        count++;
      }
    }
};

bool scanBLE(String& output) {
  blink(4, 100);
  
  CB* cb = new CB();
  
  if (!scan) {
    BLEDevice::init("Gateway");
    scan = BLEDevice::getScan();
    scan->setActiveScan(true);
  }
  
  scan->setAdvertisedDeviceCallbacks(cb);
  scan->start(5, false);
  scan->clearResults();
  
  output = cb->result + "]";
  bool found = cb->count > 0;
  
  delete cb;
  
  if (found) blink(3, 150);
  return found;
}

bool provBLE(String mac, String nome, String id) {
  blink(5, 100);
  
  if (!client) client = BLEDevice::createClient();
  if (!client->connect(BLEAddress(mac.c_str()))) return false;

  BLERemoteService* srv = client->getService(BLEUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b"));
  if (!srv) { 
    client->disconnect(); 
    return false; 
  }

  BLERemoteCharacteristic* chr = srv->getCharacteristic(BLEUUID("beb5483e-36e1-4688-b7f5-ea07361b26a8"));
  if (!chr) { 
    client->disconnect(); 
    return false; 
  }

  String cfg = "{\"nome\":\"" + nome + "\",\"id\":\"" + id + "\",\"gateway\":\"" + WiFi.macAddress() + "\"}";
  
  chr->writeValue(cfg.c_str(), cfg.length());
  delay(300);
  client->disconnect();
  return true;
}

// ===== WIFI =====
bool connectWiFi() {
  Serial.println("\n=== Conectando WiFi ===");
  Serial.println("SSID: " + wifiSSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    Serial.print(".");
    delay(500);
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✓ WiFi conectado");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC: ");
    Serial.println(WiFi.macAddress());
    
    wifi_second_chan_t secondChan;
    esp_wifi_get_channel(&wifiChannel, &secondChan);
    Serial.print("Canal: ");
    Serial.println(wifiChannel);
    
    return true;
  }
  
  return false;
}

// ===== MQTT =====
String extractValue(String json, String key) {
  int idx = json.indexOf("\"" + key + "\":\"");
  if (idx < 0) return "";
  idx += key.length() + 4;
  return json.substring(idx, json.indexOf("\"", idx));
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  blink(1, 50);
  
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("\n=== MQTT: " + String(topic) + " ===");
  Serial.println(message);
  
  if (String(topic) == "gateway/comando") {
    processCommand(message);
  }
}

// ✨ ATUALIZADO: Processa comandos MQTT (incluindo novos comandos)
void processCommand(String json) {
  String acao = extractValue(json, "acao");
  String cmdId = extractValue(json, "id");
  
  if (cmdId == lastCmdId || cmdId == "") return;
  lastCmdId = cmdId;
  
  if (acao == "ping") {
    String response = "{\"id\":\"" + cmdId + "\",\"timestamp\":" + String(millis()) + "}";
    mqtt.publish("gateway/resposta/pong", response.c_str());
    blink(2, 200);
  }
  else if (acao == "scan") {
    String result;
    scanBLE(result);
    String response = "{\"id\":\"" + cmdId + "\",\"dispositivos\":" + result + "}";
    mqtt.publish("gateway/resposta/scan", response.c_str());
  }
  else if (acao == "provisionar") {
    String mac = extractValue(json, "macSilo");
    String nome = extractValue(json, "siloNome");
    String sid = extractValue(json, "siloId");
    
    bool success = provBLE(mac, nome, sid);
    
    String response = "{\"id\":\"" + cmdId + "\",\"status\":\"";
    response += success ? "provisionado\"}" : "erro_ble\"}";
    
    mqtt.publish("gateway/resposta/provision", response.c_str());
    blink(3, 200);
  }
  // ✨ NOVO: Desintegrar (reset) via ESP-NOW
  else if (acao == "desintegrar") {
    String dispositivo = extractValue(json, "dispositivo");
    
    Serial.println("\n--- Comando: Desintegrar ---");
    Serial.println("Dispositivo: " + dispositivo);
    
    uint8_t mac[6];
    if (buscarMACPorNome(dispositivo.c_str(), mac)) {
      Comando cmd;
      memset(&cmd, 0, sizeof(cmd));
      strcpy(cmd.tipo, "reset");
      strcpy(cmd.dispositivo, dispositivo.c_str());
      cmd.ts = millis();
      
      esp_err_t result = esp_now_send(mac, (uint8_t*)&cmd, sizeof(cmd));
      
      String response = "{\"id\":\"" + cmdId + "\",\"status\":\"";
      response += (result == ESP_OK) ? "reset_enviado\"}" : "erro_envio\"}";
      
      mqtt.publish("gateway/resposta/desintegrar", response.c_str());
      
      Serial.println(result == ESP_OK ? "✓ Comando reset enviado" : "✗ Erro ao enviar");
      blink(4, 150);
    } else {
      String response = "{\"id\":\"" + cmdId + "\",\"status\":\"dispositivo_nao_encontrado\"}";
      mqtt.publish("gateway/resposta/desintegrar", response.c_str());
      Serial.println("✗ Dispositivo não encontrado no mapa");
    }
  }
  // ✨ NOVO: Atualizar nome via ESP-NOW
  else if (acao == "atualizar_nome") {
    String dispositivo = extractValue(json, "dispositivo");
    String novoNome = extractValue(json, "novoNome");
    
    Serial.println("\n--- Comando: Atualizar Nome ---");
    Serial.println("Dispositivo: " + dispositivo);
    Serial.println("Novo nome: " + novoNome);
    
    uint8_t mac[6];
    if (buscarMACPorNome(dispositivo.c_str(), mac)) {
      Comando cmd;
      memset(&cmd, 0, sizeof(cmd));
      strcpy(cmd.tipo, "update_name");
      strcpy(cmd.dispositivo, dispositivo.c_str());
      strcpy(cmd.novoNome, novoNome.c_str());
      cmd.ts = millis();
      
      esp_err_t result = esp_now_send(mac, (uint8_t*)&cmd, sizeof(cmd));
      
      String response = "{\"id\":\"" + cmdId + "\",\"status\":\"";
      response += (result == ESP_OK) ? "atualizado\"}" : "erro_envio\"}";
      
      mqtt.publish("gateway/resposta/atualizar_nome", response.c_str());
      
      Serial.println(result == ESP_OK ? "✓ Comando update enviado" : "✗ Erro ao enviar");
      blink(4, 150);
    } else {
      String response = "{\"id\":\"" + cmdId + "\",\"status\":\"dispositivo_nao_encontrado\"}";
      mqtt.publish("gateway/resposta/atualizar_nome", response.c_str());
      Serial.println("✗ Dispositivo não encontrado");
    }
  }
}

bool connectMQTT() {
  Serial.println("\n=== Conectando MQTT ===");
  
  wifiClient.setInsecure();
  
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(60);
  
  String clientId = "ESP32_GW_" + WiFi.macAddress();
  clientId.replace(":", "");
  
  if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("✓ MQTT conectado");
    mqtt.subscribe("gateway/comando");
    return true;
  }
  
  Serial.println("✗ Falha MQTT");
  return false;
}

void iniciarModoNormal() {
  Serial.println("\n=== MODO NORMAL ===");
  
  if (!connectWiFi()) {
    resetarConfigWiFi();
    return;
  }
  
  blink(2, 300);

  Serial.println("\n=== Inicializando ESP-NOW ===");
  if (esp_now_init() == ESP_OK) {
    Serial.println("✓ ESP-NOW OK");
    esp_now_register_recv_cb(OnDataRecv);
  }
  
  blink(3, 300);

  if (!connectMQTT()) {
    while (true) {
      blink(10, 100);
      delay(2000);
      if (connectMQTT()) break;
    }
  }
  
  blink(4, 300);
  
  Serial.println("\n✓✓✓ SISTEMA PRONTO ✓✓✓\n");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(LED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED, LOW);
  
  Serial.println("\n==============================");
  Serial.println("ESP32 - GATEWAY");
  Serial.println("==============================\n");
  
  blink(1, 500);
  
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(3000);
    if (digitalRead(BUTTON_PIN) == LOW) {
      resetarConfigWiFi();
    }
  }
  
  if (carregarConfigWiFi()) {
    modoAtual = MODO_NORMAL;
    iniciarModoNormal();
  } else {
    modoAtual = MODO_SETUP;
    iniciarModoSetup();
  }
}

void loop() {
  if (modoAtual == MODO_SETUP) {
    server.handleClient();
    delay(10);
  } else {
    if (!mqtt.connected()) {
      connectMQTT();
    }
    
    mqtt.loop();
    procQ();
    delay(10);
  }
}