#ifndef MQTT_H
#define MQTT_H

#include <stdint.h>
#include <stdbool.h>

// MQTT configuration structure
typedef struct {
    bool enabled;                    // "enabled": Enable/disable MQTT
    int version;                     // "version": MQTT version (3 or 3.1.1)
    char client_id[64];              // "clientId": Client identifier
    char server_address[64];         // "serverAddress": MQTT broker address
    uint16_t port;                   // "port": MQTT broker port
    uint16_t keep_alive;             // "keepAlive": Keep-alive interval in seconds
    uint16_t reconnect_no_data;      // "reconnectNoData": Reconnect timeout when no data
    uint16_t reconnect_interval;     // "reconnectInterval": Reconnection interval
    bool clean_session;              // "cleanSession": Clean session flag
    bool use_credentials;            // "useCredentials": Use authentication
    char username[32];               // "username": Authentication username
    char password[32];               // "password": Authentication password
    bool enable_last_will;           // "enableLastWill": Enable last will message
} mqtt_config_t;

// MQTT configuration functions
void mqtt_init(void);
mqtt_config_t* mqtt_get_config(void);
bool mqtt_update_config(const char *json_str);
bool mqtt_save_config_from_json(const char *json_str);

#endif
