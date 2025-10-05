#include <WiFi.h>
#include <esp_now.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define WIFI_SSID "SEU_WIFI"
#define WIFI_PASS "SUA_SENHA"
#define API_URL "http://192.168.1.100:3000/api/dados"
#define LED_PIN 7

typedef struct struct_message {
  float temperatura;
  float umidade;
  char dispositivo[32];
} struct_message;

struct_message incomingData;
unsigned long lastWiFiCheck = 0;
const unsigned long wifiCheckInterval = 30000;

void piscarLED(int vezes, int intervalo) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(intervalo);
    digitalWrite(LED_PIN, LOW);
    delay(intervalo);
  }
}

void OnDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *incomingDataPtr, int len) {
  memcpy(&incomingData, incomingDataPtr, sizeof(incomingData));
  
  Serial.printf("  Temperatura: %.2f°C\n", incomingData.temperatura);
  Serial.printf("  Umidade: %.2f%%\n", incomingData.umidade);
  Serial.printf("  Dispositivo: %s\n", incomingData.dispositivo);
  
  enviarParaAPI();
}

void enviarParaAPI() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado! Tentando reconectar...");
    reconectarWiFi();
    piscarLED(1, 500);
    return;
  }
  
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  StaticJsonDocument<200> doc;
  doc["temperatura"] = incomingData.temperatura;
  doc["umidade"] = incomingData.umidade;
  doc["dispositivo"] = incomingData.dispositivo;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Enviando para API...");
  Serial.println("  JSON: " + jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("POST enviado com sucesso! Codigo: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.println("  Resposta: " + response);
    piscarLED(2, 100);
  } else {
    Serial.printf("Erro no POST: %d\n", httpResponseCode);
    Serial.println("  Mensagem: " + http.errorToString(httpResponseCode));
    piscarLED(1, 500);
  }
  
  http.end();
}

void reconectarWiFi() {
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi reconectado!");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha na reconexao WiFi");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("\nIniciando ESP32 Central...");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  Serial.print("Conectando ao WiFi");
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 40) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado!");

  } else {
    Serial.println("\nFalha ao conectar WiFi");
  }
  
  if (esp_now_init() != ESP_OK) {
    Serial.println("Erro inicializando ESP-NOW");
    return;
  }
  Serial.println("ESP-NOW inicializado");
  
  esp_now_register_recv_cb(OnDataRecv);
  
  Serial.println("Aguardando dados dos sensores...\n");
}

void loop() {
  if (millis() - lastWiFiCheck >= wifiCheckInterval) {
    lastWiFiCheck = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi desconectado! Reconectando...");
      reconectarWiFi();
    }
  }
  
  delay(100);
}