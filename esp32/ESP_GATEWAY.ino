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
#define MQTT_USER "MQTT-USER"
#define MQTT_PASS "MQTT-PASS"
#define API_URL "API-URL"

#define LED 8
#define BUTTON_PIN 0
#define MAX_FILA 3

struct Dado {
  char d[32];  // dispositivo (_id do silo)
  float t;
  float u;
  unsigned long ts;
};

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
bool espNowIniciado = false;
enum Modo { MODO_SETUP, MODO_NORMAL };
Modo modoAtual = MODO_SETUP;

Dado fila[MAX_FILA];
bool env[MAX_FILA];
uint8_t idx = 0, cnt = 0;
unsigned long lastS = 0;
String lastCmdId = "";

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
}

bool carregarConfigWiFi() {
  preferences.begin("gateway", true);
  wifiConfigurado = preferences.getBool("configured", false);
  if (wifiConfigurado) {
    wifiSSID = preferences.getString("ssid", "");
    wifiPassword = preferences.getString("password", "");
  }
  preferences.end();
  return wifiConfigurado;
}

void resetarConfigWiFi() {
  preferences.begin("gateway", false);
  preferences.clear();
  preferences.end();
  delay(100);
  blink(10, 100);
  delay(1000);
  ESP.restart();
}

void verificarBotao() {
  static unsigned long tempoInicioBotao = 0;
  static bool botaoFoiPressionado = false;
  
  bool botaoPressionado = (digitalRead(BUTTON_PIN) == LOW);
  
  if (botaoPressionado && !botaoFoiPressionado) {
    tempoInicioBotao = millis();
    botaoFoiPressionado = true;
  }
  
  if (!botaoPressionado && botaoFoiPressionado) {
    botaoFoiPressionado = false;
    tempoInicioBotao = 0;
  }
  
  if (botaoPressionado && botaoFoiPressionado && 
      (millis() - tempoInicioBotao >= 3000)) {
    
    botaoFoiPressionado = false;
    tempoInicioBotao = 0;
    
    blink(5, 100);
    delay(500);
    resetarConfigWiFi();
  }
}

String normalizarMAC(String mac) {
  mac.toLowerCase();
  mac.replace(":", "");
  mac.replace("-", "");
  mac.replace(" ", "");
  mac.trim();
  return mac;
}

void OnDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
  if (status == ESP_NOW_SEND_SUCCESS) {
    blink(1, 50);
  } else {
    blink(3, 100);
  }
}

void OnDataRecv(const esp_now_recv_info *info, const uint8_t *data, int len) {
  if (len == sizeof(Dado)) {
    if (cnt >= MAX_FILA) return;
    memcpy(&fila[idx], data, sizeof(Dado));
    env[idx] = false;
    idx = (idx + 1) % MAX_FILA;
    cnt++;
    blink(1, 50);
  }
}

bool iniciarESPNow() {
  if (espNowIniciado) return true;
  
  esp_wifi_set_ps(WIFI_PS_NONE);
  
  esp_err_t result = esp_now_init();
  if (result != ESP_OK) {
    return false;
  }
  
  esp_now_register_send_cb(OnDataSent);
  esp_now_register_recv_cb(OnDataRecv);
  espNowIniciado = true;
  
  return true;
}

// Envia _id do silo como dispositivo
void sendAPI(Dado* d) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient h;
  h.begin(API_URL);
  h.addHeader("Content-Type", "application/json");
  char buffer[150];
  snprintf(buffer, 150, "{\"temperatura\":%.2f,\"umidade\":%.2f,\"dispositivo\":\"%s\"}", 
           d->t, d->u, d->d);
  int httpCode = h.POST((uint8_t*)buffer, strlen(buffer));
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

bool provBLE(String mac, String id) {
  blink(5, 100);
  
  if (!client) client = BLEDevice::createClient();
  
  if (!client->connect(BLEAddress(mac.c_str()))) {
    return false;
  }
  
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
  
  String gwMacNormalizado = normalizarMAC(WiFi.macAddress());
  
  // Envia _id do silo como "dispositivo"
  String cfg = "{\"dispositivo\":\"" + id + "\",\"gateway\":\"" + gwMacNormalizado + "\",\"channel\":" + String(wifiChannel) + "}";
  
  chr->writeValue(cfg.c_str(), cfg.length());
  delay(500);
  
  client->disconnect();
  
  return true;
}

bool connectWiFi() {
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    wifi_second_chan_t secondChan;
    esp_wifi_get_channel(&wifiChannel, &secondChan);
    return true;
  }
  return false;
}

String extractValue(String json, String key) {
  int idx = json.indexOf("\"" + key + "\":\"");
  if (idx < 0) return "";
  idx += key.length() + 4;
  return json.substring(idx, json.indexOf("\"", idx));
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  blink(1, 50);
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  
  if (String(topic) == "gateway/comando") {
    processCommand(message);
  }
}

void processCommand(String json) {
  String acao = extractValue(json, "acao");
  String cmdId = extractValue(json, "id");
  if (cmdId == lastCmdId || cmdId == "") return;
  lastCmdId = cmdId;

  if (acao == "ping") {
    String response = "{\"id\":\"" + cmdId + "\",\"timestamp\":" + String(millis()) + "}";
    mqtt.publish("gateway/resposta/pong", response.c_str());
    blink(2, 200);
    return;
  }

  if (acao == "scan") {
    String result;
    scanBLE(result);
    String response = "{\"id\":\"" + cmdId + "\",\"dispositivos\":" + result + "}";
    mqtt.publish("gateway/resposta/scan", response.c_str());
    return;
  }

  if (acao == "provisionar") {
    String mac = extractValue(json, "macSilo");
    String sid = extractValue(json, "siloId");
    bool success = provBLE(mac, sid);
    String response = "{\"id\":\"" + cmdId + "\",\"status\":\"";
    response += success ? "provisionado\"}" : "erro_ble\"}";
    mqtt.publish("gateway/resposta/provision", response.c_str());
    blink(3, 200);
    return;
  }
  
}

bool connectMQTT() {
  if (!WiFi.isConnected()) return false;
  wifiClient.setInsecure();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(10);
  String clientId = "ESP32_GW_" + normalizarMAC(WiFi.macAddress());
  bool connected = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
  if (connected) {
    mqtt.subscribe("gateway/comando");
    return true;
  }
  return false;
}

const char* htmlPage = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gateway - Configuracao WiFi</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background: linear-gradient(135deg,#667eea 0%,#764ba2 100%); display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .container { background:white; padding:30px; border-radius:12px; max-width:420px; width:100%; box-shadow:0 10px 30px rgba(0,0,0,.2); }
    h1 { color:#333; text-align:center; margin-bottom:8px; font-size:22px; }
    label { display:block; margin-bottom:6px; color:#333; font-weight:600; font-size:13px; }
    input { width:100%; padding:10px 12px; border:1px solid #e0e0e0; border-radius:8px; font-size:14px; }
    .btn { width:100%; padding:12px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:8px; margin-top:10px; cursor:pointer; font-weight:600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Gateway IoT</h1>
    <p style="text-align:center;color:#666;margin-bottom:20px;font-size:13px;">Configuracao WiFi</p>
    <form id="wifiForm">
      <label for="ssid">Nome da Rede (SSID)</label>
      <input type="text" id="ssid" name="ssid" placeholder="Digite o SSID" required>
      <label for="password" style="margin-top:10px;">Senha do WiFi</label>
      <input type="password" id="password" name="password" placeholder="Digite a senha" required>
      <button type="submit" class="btn">Salvar e Conectar</button>
    </form>
  </div>
  <script>
    document.getElementById('wifiForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ssid = document.getElementById('ssid').value;
      const password = document.getElementById('password').value;
      await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(password)}`
      });
      alert('Salvo! Reiniciando...');
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
    delay(800);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "Parametros invalidos");
  }
}

void iniciarModoSetup() {
  String apName = "Gateway_" + WiFi.macAddress().substring(9);
  apName.replace(":", "");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str());
  server.on("/", handleRoot);
  server.on("/mac", handleMAC);
  server.on("/save", HTTP_POST, handleSave);
  server.begin();
  blink(3, 300);
}

void iniciarModoNormal() {
  if (!connectWiFi()) {
    blink(8, 200);
    delay(5000);
    resetarConfigWiFi();
    return;
  }
  blink(2, 300);

  if (!iniciarESPNow()) {
    blink(10, 100);
    delay(3000);
    ESP.restart();
    return;
  }
  
  blink(3, 300);

  int tentativas = 0;
  while (!connectMQTT() && tentativas < 5) {
    tentativas++;
    blink(2, 100);
    delay(3000);
  }

  if (mqtt.connected()) {
    blink(4, 300);
  } else {
    blink(6, 200);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(LED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  blink(1, 500);
  
  if (carregarConfigWiFi()) {
    modoAtual = MODO_NORMAL;
    iniciarModoNormal();
  } else {
    modoAtual = MODO_SETUP;
    iniciarModoSetup();
  }
}

void loop() {
  verificarBotao();
  
  if (modoAtual == MODO_SETUP) {
    server.handleClient();
    delay(10);
    return;
  }
  
  if (!mqtt.connected()) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 30000) {
      connectMQTT();
      lastReconnect = millis();
    }
  } else {
    mqtt.loop();
  }
  
  procQ();
  delay(10);
}