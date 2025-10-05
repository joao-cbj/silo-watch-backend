#include <WiFi.h>
#include <esp_now.h>
#include <DHT.h>

// Configurações do sensor DHT22
#define DHTPIN 4
#define DHTTYPE DHT22

// MAC Address do ESP32 Central (substitua pelos valores reais)
#define CENTRAL_MAC {0x8C, 0xD0, 0xB2, 0xA8, 0xFA, 0x90}

// Nome único para este sensor (altere para cada ESP32)
#define DEVICE_NAME "ESP32_SILO_01"

DHT dht(DHTPIN, DHTTYPE);

// Estrutura de dados a ser enviada
typedef struct struct_message {
  float temperatura;
  float umidade;
  char dispositivo[32];
} struct_message;

struct_message myData;
uint8_t centralAddress[] = CENTRAL_MAC;

// Callback quando dados são enviados
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("Status envio: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "SUCESSO" : "FALHA");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n🚀 Iniciando ESP32 Sensor...");
  
  // Inicializar DHT22
  dht.begin();
  Serial.println("DHT22 inicializado");
  
  // Configurar WiFi em modo Station (necessário para ESP-NOW)
  WiFi.mode(WIFI_STA);
  Serial.print("MAC Address: ");
  Serial.println(WiFi.macAddress());
  
  // Inicializar ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Erro inicializando ESP-NOW");
    return;
  }
  Serial.println("ESP-NOW inicializado");
  
  // Registrar callback de envio
  esp_now_register_send_cb(OnDataSent);
  
  // Adicionar ESP32 Central como peer
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, centralAddress, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Falha ao adicionar peer");
    return;
  }
  Serial.println("Central adicionado como peer");
  Serial.println("Iniciando leituras...\n");
}

void loop() {
  // Ler dados do DHT22
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  // Verificar se a leitura foi bem-sucedida
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Erro na leitura do DHT22");
    delay(2000);
    return;
  }
  
  // Preencher estrutura de dados
  myData.temperatura = temp;
  myData.umidade = hum;
  strcpy(myData.dispositivo, DEVICE_NAME);
  
  // Mostrar dados no Serial Monitor
  Serial.printf("Temperatura: %.2f°C\n", temp);
  Serial.printf("Umidade: %.2f%%\n", hum);
  Serial.printf("Dispositivo: %s\n", DEVICE_NAME);
  
  // Enviar dados via ESP-NOW
  esp_err_t result = esp_now_send(centralAddress, (uint8_t *)&myData, sizeof(myData));
  
  if (result == ESP_OK) {
    Serial.println("Dados enviados para o Central");
  } else {
    Serial.println("Erro ao enviar dados");
  }
  
  // Aguardar 30 segundos antes da próxima leitura
  delay(30000);
}