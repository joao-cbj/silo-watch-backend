#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Config Wi-Fi
const char* ssid = "SUA_REDE";
const char* password = "SUA_SENHA";

// URL da API
const char* apiURL = "API_URL/api/dados";

void setup() {
  Serial.begin(115200);

  // Conectar Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("🔄 Conectando ao WiFi...");
  }
  Serial.println("WiFi conectado!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiURL);
    http.addHeader("Content-Type", "application/json");

    // Criar JSON com os dados simulados
    StaticJsonDocument<300> doc;
    doc["temperatura"] = random(200, 350) / 10.0; // 20.0 a 35.0 °C
    doc["umidade"] = random(400, 800) / 10.0;     // 40.0 a 80.0 %
    doc["dispositivo"] = "ESP32_REAL";           // Identificador do dispositivo

    String jsonString;
    serializeJson(doc, jsonString);

    // Enviar POST
    int httpCode = http.POST(jsonString);
    String response = http.getString();

    Serial.printf("📡 HTTP Code: %d\n", httpCode);
    Serial.println("📩 Resposta: " + response);

    http.end();
  } else {
    Serial.println("WiFi desconectado!");
  }

  delay(30000); // Enviar a cada 30 segundos
}
