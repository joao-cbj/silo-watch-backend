/**
 * ESP32 - SILO (Sensor Node)
 * Provisionamento via BLE
 * Envio de dados via ESP-NOW para Gateway
 */

#include <WiFi.h>
#include <esp_now.h>
#include <DHT.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

// ===== CONFIGURAÇÕES DO HARDWARE =====
#define DHTPIN 4
#define DHTTYPE DHT22
#define LED 8
#define BUTTON_PIN 0  // Botão para forçar modo SETUP

// ===== UUIDs BLE (mesmos do Gateway) =====
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ===== VARIÁVEIS GLOBAIS =====
DHT dht(DHTPIN, DHTTYPE);
Preferences preferences;

// Configurações salvas na flash
String siloNome = "";
String siloId = "";
uint8_t gatewayMac[6] = {0};
bool configurado = false;

// Estado do sistema
enum Modo { MODO_SETUP, MODO_NORMAL };
Modo modoAtual = MODO_SETUP;

// BLE
BLEServer* bleServer = nullptr;
BLECharacteristic* bleChar = nullptr;
bool deviceConnected = false;
bool configRecebida = false;

// ESP-NOW - Estrutura de dados (mesma do Gateway)
struct Dado {
  char d[32];        // dispositivo
  float t;           // temperatura
  float u;           // umidade
  unsigned long ts;  // timestamp
};

Dado dadosEnvio;

// ===== FUNÇÕES AUXILIARES =====
void blink(int vezes, int intervalo = 200) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED, HIGH);
    delay(intervalo);
    digitalWrite(LED, LOW);
    delay(intervalo);
  }
}

void salvarConfig() {
  preferences.begin("silo", false);
  preferences.putString("nome", siloNome);
  preferences.putString("id", siloId);
  preferences.putBytes("gateway", gatewayMac, 6);
  preferences.putBool("config", true);
  preferences.end();
  
  Serial.println("✓ Configuração salva");
}

bool carregarConfig() {
  preferences.begin("silo", true);
  configurado = preferences.getBool("config", false);
  
  if (configurado) {
    siloNome = preferences.getString("nome", "");
    siloId = preferences.getString("id", "");
    preferences.getBytes("gateway", gatewayMac, 6);
    
    Serial.println("✓ Config carregada");
    Serial.println("Nome: " + siloNome);
    Serial.println("ID: " + siloId);
    Serial.printf("Gateway: %02X:%02X:%02X:%02X:%02X:%02X\n",
                  gatewayMac[0], gatewayMac[1], gatewayMac[2],
                  gatewayMac[3], gatewayMac[4], gatewayMac[5]);
  }
  
  preferences.end();
  return configurado;
}

void resetarConfig() {
  preferences.begin("silo", false);
  preferences.clear();
  preferences.end();
  
  Serial.println("✓ Config resetada");
  blink(10, 100);
  ESP.restart();
}

// ===== BLE CALLBACKS =====
class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("BLE: Cliente conectado");
    blink(2, 100);
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("BLE: Cliente desconectado");
    
    if (configRecebida) {
      Serial.println("✓ Reiniciando em modo normal...");
      delay(1000);
      ESP.restart();
    } else {
      // Reinicia advertising
      BLEDevice::startAdvertising();
      Serial.println("BLE: Advertising reiniciado");
    }
  }
};

class CharCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String json = pCharacteristic->getValue().c_str();
    
    if (json.length() > 0) {
      Serial.println("BLE: Dados recebidos");
      Serial.println(json);
      
      // Parse JSON
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, json);
      
      if (!error) {
        siloNome = doc["nome"].as<String>();
        siloId = doc["id"].as<String>();
        String gwMac = doc["gateway"].as<String>();
        
        // Converte MAC string para bytes
        sscanf(gwMac.c_str(), "%hhx:%hhx:%hhx:%hhx:%hhx:%hhx",
               &gatewayMac[0], &gatewayMac[1], &gatewayMac[2],
               &gatewayMac[3], &gatewayMac[4], &gatewayMac[5]);
        
        Serial.println("✓ Config recebida!");
        Serial.println("Nome: " + siloNome);
        Serial.println("ID: " + siloId);
        Serial.printf("Gateway: %02X:%02X:%02X:%02X:%02X:%02X\n",
                      gatewayMac[0], gatewayMac[1], gatewayMac[2],
                      gatewayMac[3], gatewayMac[4], gatewayMac[5]);
        
        // Salva configuração
        salvarConfig();
        configRecebida = true;
        
        blink(5, 200);
      } else {
        Serial.println("✗ Erro ao parsear JSON");
      }
    }
  }
};

// ===== MODO SETUP (BLE) =====
void iniciarModoSetup() {
  Serial.println("\n=== MODO SETUP (BLE) ===");
  
  // Desliga WiFi para economizar energia
  WiFi.mode(WIFI_OFF);
  delay(100);
  
  // Gera nome único baseado no MAC
  String macAddress = WiFi.macAddress();
  macAddress.replace(":", "");
  String deviceName = "SILO_" + macAddress.substring(6);
  
  Serial.println("Nome BLE: " + deviceName);
  Serial.println("MAC: " + WiFi.macAddress());
  
  // Inicializa BLE
  BLEDevice::init(deviceName.c_str());
  
  // Cria servidor BLE
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  
  // Cria serviço
  BLEService *service = bleServer->createService(SERVICE_UUID);
  
  // Cria característica
  bleChar = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE
  );
  
  bleChar->setCallbacks(new CharCallbacks());
  bleChar->addDescriptor(new BLE2902());
  
  // Inicia serviço
  service->start();
  
  // Inicia advertising
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("✓ BLE ativo - Aguardando provisionamento...");
  blink(3, 300);
}

// ===== MODO NORMAL (ESP-NOW) =====
void OnDataSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
  Serial.print("\n=== ESP-NOW: Callback Envio ===\n");
  Serial.print("Status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "✓ SUCESSO" : "✗ FALHA");
  
  if (status == ESP_NOW_SEND_SUCCESS) {
    blink(1, 50);
  } else {
    blink(3, 500);
    Serial.println("⚠️  Possíveis causas:");
    Serial.println("   - Gateway desligado");
    Serial.println("   - Gateway em canal WiFi diferente");
    Serial.println("   - Fora de alcance");
  }
}

void iniciarModoNormal() {
  Serial.println("\n=== MODO NORMAL (ESP-NOW) ===");
  
  // Desliga BLE se estiver ativo
  if (bleServer != nullptr) {
    BLEDevice::deinit(true);
  }
  
  // Desconecta WiFi
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(100);
  
  // Inicializa WiFi em modo Station (necessário para ESP-NOW)
  WiFi.mode(WIFI_STA);
  Serial.println("MAC: " + WiFi.macAddress());
  
  // Inicializa ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("✗ Erro ESP-NOW");
    blink(10, 100);
    ESP.restart();
    return;
  }
  
  Serial.println("✓ ESP-NOW OK");
  
  // Registra callback
  esp_now_register_send_cb(OnDataSent);
  Serial.println("✓ Callback registrado");
  
  // Adiciona Gateway como peer
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, gatewayMac, 6);
  peerInfo.channel = 0;  // 0 = usa o canal atual (dinâmico)
  peerInfo.encrypt = false;
  peerInfo.ifidx = WIFI_IF_STA;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("✗ Erro ao adicionar peer");
    blink(10, 100);
    ESP.restart();
    return;
  }
  
  Serial.println("✓ Gateway adicionado");
  Serial.printf("Gateway: %02X:%02X:%02X:%02X:%02X:%02X\n",
                gatewayMac[0], gatewayMac[1], gatewayMac[2],
                gatewayMac[3], gatewayMac[4], gatewayMac[5]);
  
  // Inicializa sensor DHT
  dht.begin();
  Serial.println("✓ DHT22 OK");
  
  Serial.println("\n✓✓✓ SISTEMA PRONTO ✓✓✓");
  Serial.println("Enviando dados a cada 30s...\n");
  blink(4, 200);
}

void enviarDados() {
  // Lê sensor
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  if (isnan(temp) || isnan(hum)) {
    Serial.println("✗ Erro leitura DHT");
    blink(3, 500);
    return;
  }
  
  // Prepara estrutura
  memset(&dadosEnvio, 0, sizeof(dadosEnvio));
  siloNome.toCharArray(dadosEnvio.d, 32);
  dadosEnvio.t = temp;
  dadosEnvio.u = hum;
  dadosEnvio.ts = millis();
  
  // Exibe no serial
  Serial.println("\n========== LEITURA ==========");
  Serial.printf("Silo: %s\n", dadosEnvio.d);
  Serial.printf("Temp: %.2f °C\n", temp);
  Serial.printf("Umid: %.2f %%\n", hum);
  Serial.printf("Timestamp: %lu ms\n", dadosEnvio.ts);
  Serial.printf("Tamanho: %d bytes\n", sizeof(dadosEnvio));
  Serial.println("Enviando para Gateway...");
  
  // Envia via ESP-NOW
  esp_err_t result = esp_now_send(gatewayMac, (uint8_t *)&dadosEnvio, sizeof(dadosEnvio));
  
  if (result == ESP_OK) {
    Serial.println("✓ Envio iniciado (aguardando callback)");
  } else {
    Serial.print("✗ Erro no envio: ");
    Serial.println(result);
    blink(5, 300);
  }
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(LED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED, LOW);
  
  Serial.println("\n==============================");
  Serial.println("ESP32 - SILO SENSOR NODE");
  Serial.println("BLE + ESP-NOW");
  Serial.println("==============================");
  
  blink(1, 500);
  
  
  // Verifica botão de reset (mantém 3s)
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("Botão detectado. Reset em 3s...");
    delay(3000);
    if (digitalRead(BUTTON_PIN) == LOW) {
      resetarConfig();
    }
  }
  
  // Carrega configuração
  if (carregarConfig()) {
    modoAtual = MODO_NORMAL;
    iniciarModoNormal();
  } else {
    modoAtual = MODO_SETUP;
    iniciarModoSetup();
  }
}

// ===== LOOP =====
void loop() {
  if (modoAtual == MODO_NORMAL) {
    enviarDados();
    delay(30000); // Envia a cada 30 segundos
  } else {
    // Modo setup aguarda conexão BLE
    delay(1000);
  }
}