#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <HTTPClient.h>

extern "C" {
  #include "esp_wifi.h"
}

#define WIFI_SSID "WIFI-SSID"
#define WIFI_PASS "WIFI-PASSWORD"
#define MQTT_BROKER "MQTT-URL"
#define MQTT_PORT 8883
#define MQTT_USER "USER-MQTT"
#define MQTT_PASS "PASSWORD-MQTT"
#define API_URL "URL-API"

#define LED 8
#define MAX_FILA 3
#define WIFI_CHANNEL 1  // Canal fixo para ESP-NOW

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

BLEScan* scan = nullptr;
BLEClient* client = nullptr;

struct Dado {
  char d[32];
  float t;
  float u;
  unsigned long ts;
};

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

void OnDataRecv(const esp_now_recv_info *info, const uint8_t *data, int len) {
  if (len != sizeof(Dado) || cnt >= MAX_FILA) return;
  memcpy(&fila[idx], data, sizeof(Dado));
  env[idx] = false;
  idx = (idx + 1) % MAX_FILA;
  cnt++;
  blink(1, 50);
}

void sendAPI(Dado* d) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient h;
  h.begin(API_URL);
  h.addHeader("Content-Type", "application/json");
  
  char buffer[150];
  snprintf(buffer, 150, "{\"temperatura\":%.2f,\"umidade\":%.2f,\"dispositivo\":\"%s\"}", 
           d->t, d->u, d->d);
  
  h.POST((uint8_t*)buffer, strlen(buffer));
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
  
  if (found) {
    blink(3, 150);
  }
  
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

bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  
  // Configura canal antes de conectar
  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  conf.sta.channel = WIFI_CHANNEL;
  esp_wifi_set_config(WIFI_IF_STA, &conf);
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    attempts++;
  }
  
  return WiFi.status() == WL_CONNECTED;
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
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
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
    
    if (mqtt.publish("gateway/resposta/pong", response.c_str())) {
      blink(2, 200);
    }
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
    if (success) {
      response += "provisionado\"}";
      blink(3, 200);
    } else {
      response += "erro_ble\",\"error\":\"Falha ao conectar via BLE\"}";
    }
    
    mqtt.publish("gateway/resposta/provision", response.c_str());
  }
}

bool connectMQTT() {
  wifiClient.setInsecure();
  
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(60);
  
  String clientId = "ESP32_GW_" + WiFi.macAddress();
  clientId.replace(":", "");
  
  if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    mqtt.subscribe("gateway/comando");
    return true;
  }
  
  return false;
}

void setup() {
  pinMode(LED, OUTPUT);
  digitalWrite(LED, LOW);
  
  blink(1, 500);
  delay(1000);

  if (!connectWiFi()) {
    while (true) {
      blink(10, 100);
      delay(2000);
      if (connectWiFi()) break;
    }
  }
  
  blink(2, 300);
  delay(1000);

  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(OnDataRecv);
  }
  
  blink(3, 300);
  delay(1000);

  if (!connectMQTT()) {
    while (true) {
      blink(10, 100);
      delay(2000);
      if (connectMQTT()) break;
    }
  }
  
  blink(4, 300);
  delay(1000);
  
  for (int i = 0; i < 20; i++) {
    digitalWrite(LED, HIGH);
    delay(30);
    digitalWrite(LED, LOW);
    delay(30);
  }
}

void loop() {
  if (!mqtt.connected()) {
    blink(1, 100);
    connectMQTT();
  }
  
  mqtt.loop();
  procQ();
  delay(10);
}