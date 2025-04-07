#ifndef MQTT_HANDLE_H
#define MQTT_HANDLE_H

#include "mqtt.h"

int mqtt_client_init(void);
void mqtt_client_cleanup(void);
int mqtt_subscribe(const char* topic, int qos);
int mqtt_publish(const char* topic, const char* payload, int qos, int retained);

#endif
