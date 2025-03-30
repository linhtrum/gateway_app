#ifndef MQTT_H
#define MQTT_H

#include <stdint.h>
#include <stdbool.h>

// MQTT configuration structure
typedef struct {
    bool enabled;                    // "enabled": Enable/disable MQTT
    uint8_t version;                 // "version": MQTT version (3 or 5)
    char client_id[64];              // "clientId": Client identifier
    char server_address[128];        // "serverAddress": MQTT broker address
    uint16_t port;                   // "port": MQTT broker port
    uint16_t keep_alive;             // "keepAlive": Keep-alive interval in seconds
    uint16_t reconnect_no_data;      // "reconnectNoData": Reconnect timeout when no data
    uint16_t reconnect_interval;     // "reconnectInterval": Reconnection interval
    bool clean_session;              // "cleanSession": Clean session flag
    bool use_credentials;            // "useCredentials": Use authentication
    char username[32];               // "username": Authentication username
    char password[32];               // "password": Authentication password
    bool enable_last_will;           // "enableLastWill": Enable last will message
    char last_will_topic[128];       // "lastWillTopic": Last will topic
    char last_will_message[256];     // "lastWillMessage": Last will message
    uint8_t last_will_qos;           // "lastWillQos": Last will QoS
    bool last_will_retained;         // "lastWillRetained": Last will retained flag
} mqtt_config_t;

// MQTT publish topic structure
typedef struct {
    bool enabled;                    // Enable/disable topic
    uint8_t transmission_mode;       // Transmission mode
    char topic_string[128];          // Topic string
    char topic_alias[32];            // Topic alias
    uint8_t binding_ports;           // Binding ports
    uint8_t qos;                     // Quality of service
    bool retained_message;           // Retained message flag
    bool io_control_query;           // IO control query flag
} mqtt_pub_topic_t;

// MQTT subscribe topic structure
typedef struct {
    bool enabled;                    // Enable/disable topic
    uint8_t transmission_mode;       // Transmission mode
    char topic_string[128];          // Topic string
    char delimiter[8];               // Delimiter
    uint8_t binding_ports;           // Binding ports
    uint8_t qos;                     // Quality of service
    bool io_control_query;           // IO control query flag
} mqtt_sub_topic_t;

// MQTT topics list structure
typedef struct {
    mqtt_pub_topic_t pub_topics[8];  // Array of publish topics (max 8)
    mqtt_sub_topic_t sub_topics[8];  // Array of subscribe topics (max 8)
    uint8_t pub_count;               // Number of publish topics
    uint8_t sub_count;               // Number of subscribe topics
} mqtt_topics_t;

#define MQTT_TOPICS_MAX_COUNT 8

// MQTT configuration functions
void mqtt_init(void);
mqtt_config_t* mqtt_get_config(void);
bool mqtt_save_config_from_json(const char *json_str);

// Check if MQTT is enabled
bool mqtt_is_enabled(void);

// Initialize MQTT topics
void mqtt_topics_init(void);

// Get MQTT topics
mqtt_topics_t* mqtt_get_topics(void);

bool pub_topic_save_config_from_json(const char *json_str);
bool sub_topic_save_config_from_json(const char *json_str);

#endif
