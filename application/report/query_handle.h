#ifndef QUERY_HANDLE_H
#define QUERY_HANDLE_H

#include <stdbool.h>
#include <stdint.h>
#include <pthread.h>
#include "../modbus/device.h"
#include "../mqtt/mqtt.h"

#define DBG_TAG "QUERY_HANDLE"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Maximum number of data points in a single message
#define MAX_DATA_POINTS 5

// Query/Set protocol types
typedef enum {
    QUERY_SET_TYPE_MODBUS_RTU = 0,
    QUERY_SET_TYPE_MODBUS_TCP = 1,
    QUERY_SET_TYPE_JSON = 2
} query_set_type_t;

// Data point structure for JSON protocol
typedef struct {
    char name[64];      // Node name
    char value[64];     // Value (for write operations)
    char err[32];       // Error code (for responses)
} data_point_t;

// JSON protocol structure
typedef struct {
    char ver[16];       // Protocol version
    char dir[16];       // Transmission direction (read/write)
    char id[32];        // Message ID
    data_point_t r_data[MAX_DATA_POINTS];  // Read data points
    int r_data_count;   // Number of read data points
    data_point_t w_data[MAX_DATA_POINTS];  // Write data points
    int w_data_count;   // Number of write data points
} json_protocol_t;

// Query handle context
typedef struct {
    bool running;
    pthread_t thread;
    pthread_mutex_t mutex;
} query_handle_ctx_t;

// MQTT message callback
void query_handle_mqtt_message(const char *topic, const char *payload, int payload_len);

#endif
