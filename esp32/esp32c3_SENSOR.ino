#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- CONFIGURAÇÕES DO SENSOR E DO DISPOSITIVO ---
#define DHTPIN 4                 // Pino onde o sensor DHT22 está conectado
#define DHTTYPE DHT22            // Tipo do sensor (DHT22)
#define LED_BUILTIN 8            // Pino do LED embutido (usado para indicar status)

// Configurações de rede — substituir com seus próprios dados
#define WIFI_SSID "<SEU_SSID_AQUI>"
#define WIFI_PASS "<SUA_SENHA_AQUI>"

// Endereço da API — substituir pelo endpoint real do backend
#define API_URL "<URL_DA_SUA_API_AQUI>"

#define DEVICE_NAME "ESP32_SILO_01" // Nome identificador do dispositivo

// Inicializa o sensor DHT
DHT dht(DHTPIN, DHTTYPE);

// --- FUNÇÃO AUXILIAR: Piscar LED ---
void piscarLED(int vezes, int intervalo) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(intervalo);
    digitalWrite(LED_BUILTIN, LOW);
    delay(intervalo);
  }
}

// --- FUNÇÃO AUXILIAR: Reconectar ao WiFi ---
void reconectarWiFi() {
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  Serial.print("Tentando reconectar ao WiFi");
  int tentativas = 0;

  // Tenta reconectar várias vezes
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi reconectado com sucesso!");
    Serial.print("IP obtido: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha na reconexão WiFi");
  }
}

// --- FUNÇÃO: Enviar dados para API ---
bool enviarParaAPI(float temperatura, float umidade) {
  // Verifica conexão WiFi
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

  // Monta JSON com os dados
  StaticJsonDocument<200> doc;
  doc["temperatura"] = temperatura;
  doc["umidade"] = umidade;
  doc["dispositivo"] = DEVICE_NAME;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("Enviando dados para API...");
  Serial.println("JSON: " + jsonString);

  unsigned long inicio = millis();
  int httpResponseCode = -1;
  bool sucesso = false;

  // Tenta enviar repetidamente durante 5 segundos
  while (millis() - inicio < 5000) {
    httpResponseCode = http.POST(jsonString);
    if (httpResponseCode > 0) {
      sucesso = true;
      break;
    }
    Serial.println("Falha no envio. Tentando novamente...");
    delay(1000);
  }

  if (sucesso) {
    Serial.printf("POST enviado com sucesso! Código: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.println("Resposta da API: " + response);
    piscarLED(2, 100);
  } else {
    Serial.printf("Erro ao enviar dados após 5s. Último código: %d\n", httpResponseCode);
    piscarLED(1, 500);
  }

  http.end();
  return sucesso;
}

// --- CONFIGURAÇÃO INICIAL ---
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  Serial.println("\nIniciando ESP32 com sensor DHT22...");
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
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println("\nFalha ao conectar ao WiFi");
  }

  Serial.println("Setup concluído. Iniciando leituras...\n");
}

// --- LOOP PRINCIPAL ---
void loop() {
  // Ler temperatura e umidade
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("Erro na leitura do sensor DHT22");
    piscarLED(1, 500);
    delay(2000);
    return;
  }

  // Exibir dados no Serial Monitor
  Serial.println("Leitura atual:");
  Serial.printf("Temperatura: %.2f °C\n", temp);
  Serial.printf("Umidade: %.2f %%\n", hum);
  Serial.printf("Dispositivo: %s\n", DEVICE_NAME);

  // Enviar dados para API
  enviarParaAPI(temp, hum);

  Serial.println("-----------------------------\n");

  // Espera 30 segundos até a próxima leitura
  delay(30000);
}