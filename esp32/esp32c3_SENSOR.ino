#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- CONFIGURAÇÕES ---
#define DHTPIN 4
#define DHTTYPE DHT22
#define LED_BUILTIN 8   // pino do LED embutido
#define WIFI_SSID "DK Router"
#define WIFI_PASS "dankia77"
#define API_URL "https://silo-watch-backend.onrender.com/api/dados"
#define DEVICE_NAME "ESP32_SILO_01"

DHT dht(DHTPIN, DHTTYPE);

// --- FUNÇÕES AUXILIARES ---
void piscarLED(int vezes, int intervalo) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(intervalo);
    digitalWrite(LED_BUILTIN, LOW);
    delay(intervalo);
  }
}

void reconectarWiFi() {
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  Serial.print("Reconectando WiFi");
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi reconectado!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha na reconexão WiFi");
  }
}

// --- ENVIO PARA API (com tentativas por 5 segundos) ---
bool enviarParaAPI(float temperatura, float umidade) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado! Tentando reconectar...");
    reconectarWiFi();
    piscarLED(1, 500);
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  StaticJsonDocument<200> doc;
  doc["temperatura"] = temperatura;
  doc["umidade"] = umidade;
  doc["dispositivo"] = DEVICE_NAME;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("Enviando para API...");
  Serial.println("  JSON: " + jsonString);

  unsigned long inicio = millis();
  int httpResponseCode = -1;
  bool sucesso = false;

  // Tenta enviar repetidamente por até 5 segundos
  while (millis() - inicio < 5000) {
    httpResponseCode = http.POST(jsonString);
    if (httpResponseCode > 0) {
      sucesso = true;
      break;
    }
    Serial.println("Falha no envio, tentando novamente...");
    delay(1000);
  }

  if (sucesso) {
    Serial.printf("POST enviado com sucesso! Código: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.println("  Resposta: " + response);
    piscarLED(2, 100);
  } else {
    Serial.printf("Erro ao enviar após 5s. Último código: %d\n", httpResponseCode);
    piscarLED(1, 500);
  }

  http.end();
  return sucesso;
}

// --- SETUP ---
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  Serial.println("\nIniciando ESP32 Sensor...");
  dht.begin();

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
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("  MAC: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println("\nFalha ao conectar WiFi");
  }

  Serial.println("Iniciando leituras...\n");
}

// --- LOOP ---
void loop() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("Erro na leitura do DHT22");
    piscarLED(1, 500);
    delay(2000);
    return;
  }

  Serial.println("Leitura do sensor:");
  Serial.printf("  Temperatura: %.2f C\n", temp);
  Serial.printf("  Umidade: %.2f%%\n", hum);
  Serial.printf("  Dispositivo: %s\n", DEVICE_NAME);

  enviarParaAPI(temp, hum);

  Serial.println("-----------------------------\n");
  delay(30000); // leitura a cada 30 segundos
}
