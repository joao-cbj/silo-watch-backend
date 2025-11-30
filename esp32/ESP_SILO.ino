#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <DHT.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define LED 8
#define BUTTON_PIN 1

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

struct Dado {
  char d[32];  // dispositivo (nome do silo)
  float t;
  float u;
  unsigned long ts;
};

DHT dht(DHTPIN, DHTTYPE);
Preferences preferences;

String dispositivo = "";  // ID do silo (MongoDB ObjectId)
uint8_t gatewayMac[6] = {0};
uint8_t wifiChannel = 1;
bool configurado = false;

enum Modo { MODO_SETUP, MODO_NORMAL };
Modo modoAtual = MODO_SETUP;

BLEServer* bleServer = nullptr;
BLECharacteristic* bleChar = nullptr;
bool deviceConnected = false;
bool configRecebida = false;

Dado dadosEnvio;

void blink(int vezes, int intervalo = 200) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED, HIGH);
    delay(intervalo);
    digitalWrite(LED, LOW);
    delay(intervalo);
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

void salvarConfig() {
  preferences.begin("silo", false);
  preferences.putString("dispositivo", dispositivo);
  preferences.putBytes("gateway", gatewayMac, 6);
  preferences.putUChar("channel", wifiChannel);
  preferences.putBool("config", true);
  preferences.end();
  delay(50);
}

bool carregarConfig() {
  preferences.begin("silo", true);
  configurado = preferences.getBool("config", false);

  if (configurado) {
    dispositivo = preferences.getString("dispositivo", "");
    preferences.getBytes("gateway", gatewayMac, 6);
    wifiChannel = preferences.getUChar("channel", 1);
  }

  preferences.end();
  return configurado && dispositivo.length() > 0;
}

void apagarConfig() {
  for (int tentativa = 1; tentativa <= 5; tentativa++) {
    preferences.begin("silo", false);
    preferences.clear();
    preferences.end();
    
    delay(100);
    
    preferences.begin("silo", false);
    preferences.putBool("config", false);
    preferences.putString("dispositivo", "");
    preferences.remove("gateway");
    preferences.remove("channel");
    preferences.end();
    
    delay(200);
    
    preferences.begin("silo", true);
    bool ainda = preferences.getBool("config", false);
    String dispVerif = preferences.getString("dispositivo", "");
    preferences.end();
    
    if (!ainda && dispVerif == "") {
      blink(5, 150);
      return;
    }
    
    delay(100);
  }
  
  blink(5, 150);
}

void resetarConfig() {
  if (modoAtual == MODO_NORMAL) {
    esp_now_deinit();
    delay(200);
  }
  
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(200);
  
  apagarConfig();
  
  for (int i = 0; i < 3; i++) {
    delay(200);
    preferences.begin("silo", true);
    bool ainda = preferences.getBool("config", false);
    preferences.end();
    
    if (!ainda) break;
    
    preferences.begin("silo", false);
    preferences.clear();
    preferences.end();
  }
  
  delay(100);
  blink(10, 100);
  delay(1000);
  ESP.restart();
}

void verificarBotao() {
  static unsigned long tempoInicioBotao = 0;
  static bool botaoFoiPressionado = false;
  
  bool botaoPressionado = (digitalRead(BUTTON_PIN) == LOW);
  
  // Detecta início do pressionamento
  if (botaoPressionado && !botaoFoiPressionado) {
    tempoInicioBotao = millis();
    botaoFoiPressionado = true;
  }
  
  // Detecta soltura do botão
  if (!botaoPressionado && botaoFoiPressionado) {
    botaoFoiPressionado = false;
    tempoInicioBotao = 0;
  }
  
  // Verifica se passou 5 segundos COM o botão ainda pressionado
  if (botaoPressionado && botaoFoiPressionado && 
      (millis() - tempoInicioBotao >= 5000)) {
    
    // ✅ IMPORTANTE: Reseta flags ANTES de resetar
    botaoFoiPressionado = false;
    tempoInicioBotao = 0;
    
    blink(5, 100);
    delay(500);
    resetarConfig();  // Só executa UMA vez
  }
}

class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    blink(2, 100);
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    if (configRecebida) {
      delay(1000);
      ESP.restart();
    } else {
      BLEDevice::startAdvertising();
    }
  }
};

class CharCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String json = pCharacteristic->getValue().c_str();
    if (json.length() == 0) return;

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, json);
    if (error) return;

    if (doc.containsKey("dispositivo")) {
      dispositivo = doc["dispositivo"].as<String>();
      String gwMac = doc["gateway"].as<String>();
      
      if (doc.containsKey("channel")) {
        wifiChannel = doc["channel"].as<uint8_t>();
      } else {
        wifiChannel = 1;
      }
      
      gwMac = normalizarMAC(gwMac);
      
      if (gwMac.length() != 12) {
        blink(10, 100);
        return;
      }
      
      for (int i = 0; i < 6; i++) {
        String byteStr = gwMac.substring(i * 2, i * 2 + 2);
        gatewayMac[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
      }

      salvarConfig();
      configRecebida = true;
      blink(5, 200);
    }
  }
};

void iniciarModoSetup() {
  WiFi.mode(WIFI_OFF);
  delay(100);
  WiFi.mode(WIFI_STA);
  delay(500);
  
  String macAddress = WiFi.macAddress();
  
  WiFi.mode(WIFI_OFF);
  delay(100);
  
  macAddress.replace(":", "");
  String deviceName = "SILO_" + macAddress.substring(6);
  
  if (deviceName == "SILO_000000" || deviceName.length() < 8) {
    WiFi.mode(WIFI_STA);
    delay(1000);
    macAddress = WiFi.macAddress();
    macAddress.replace(":", "");
    deviceName = "SILO_" + macAddress.substring(6);
    WiFi.mode(WIFI_OFF);
  }

  BLEDevice::init(deviceName.c_str());

  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService *service = bleServer->createService(SERVICE_UUID);

  bleChar = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE
  );

  bleChar->setCallbacks(new CharCallbacks());
  bleChar->addDescriptor(new BLE2902());

  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  blink(3, 300);
}

void OnDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
  if (status == ESP_NOW_SEND_SUCCESS) {
    blink(1, 50);
  } else {
    blink(3, 300);
  }
}

void iniciarModoNormal() {
  BLEDevice::deinit(true);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(wifiChannel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);
  
  delay(100);

  if (esp_now_init() != ESP_OK) {
    ESP.restart();
  }

  esp_now_register_send_cb(OnDataSent);

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, gatewayMac, 6);
  peerInfo.channel = wifiChannel;
  peerInfo.encrypt = false;
  peerInfo.ifidx = WIFI_IF_STA;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    ESP.restart();
  }

  dht.begin();
  blink(4, 200);
}

void enviarDados() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    return;
  }

  memset(&dadosEnvio, 0, sizeof(dadosEnvio));
  dispositivo.toCharArray(dadosEnvio.d, 32);
  dadosEnvio.t = temp;
  dadosEnvio.u = hum;
  dadosEnvio.ts = millis();

  esp_err_t result = esp_now_send(gatewayMac, (uint8_t *)&dadosEnvio, sizeof(dadosEnvio));
  
  if (result != ESP_OK) {
    delay(500);
    esp_now_send(gatewayMac, (uint8_t *)&dadosEnvio, sizeof(dadosEnvio));
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(LED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED, LOW);

  blink(1, 300);

  if (carregarConfig()) {
    modoAtual = MODO_NORMAL;
    iniciarModoNormal();
  } else {
    modoAtual = MODO_SETUP;
    iniciarModoSetup();
  }
}

void loop() {
  verificarBotao();
  
  if (modoAtual == MODO_NORMAL) {
    if (dispositivo.length() == 0) {
      delay(1000);
      ESP.restart();
      return;
    }
    
    static unsigned long ultimoEnvio = 0;
    unsigned long agora = millis();
    
    if (agora - ultimoEnvio >= 30000) {
      enviarDados();
      ultimoEnvio = agora;
    }
    
    delay(100);  // Delay curto para verificar botão frequentemente
  } else {
    delay(1000);
  }
}