#include "serial_config.h"
#include "db.h"
#include <string.h>
#include <stdio.h>
#include <cJSON.h>

#define DBG_TAG "SERIAL_CONFIG"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define SERIAL_CONFIG_KEY "serial_config"
#define DEFAULT_PORT "/dev/ttymxc1"
#define DEFAULT_BAUD_RATE 9600
#define DEFAULT_DATA_BITS 8
#define DEFAULT_PARITY 0
#define DEFAULT_STOP_BITS 1
#define DEFAULT_FLOW_CONTROL 0

static serial_config_t g_serial_config = {
    .port = DEFAULT_PORT,
    .baudRate = DEFAULT_BAUD_RATE,
    .dataBits = DEFAULT_DATA_BITS,
    .parity = DEFAULT_PARITY,
    .stopBits = DEFAULT_STOP_BITS,
    .flowControl = DEFAULT_FLOW_CONTROL
};


// Load serial configuration from database
static bool parse_serial_config(char *json_str, serial_config_t *config) {
    if (!json_str || !config) {
        return false;
    }
    // Parse JSON string
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        return false;
    }

    // Extract values from JSON
    cJSON *port = cJSON_GetObjectItem(root, "port");
    cJSON *baudRate = cJSON_GetObjectItem(root, "baudRate");
    cJSON *dataBits = cJSON_GetObjectItem(root, "dataBits");
    cJSON *parity = cJSON_GetObjectItem(root, "parity");
    cJSON *stopBits = cJSON_GetObjectItem(root, "stopBits");
    cJSON *flowControl = cJSON_GetObjectItem(root, "flowControl");

    if (!port || !baudRate || !dataBits || !parity || !stopBits || !flowControl) {
        cJSON_Delete(root);
        return false;
    }

    // Copy values to config structure
    strncpy(config->port, port->valuestring, sizeof(config->port) - 1);
    config->baudRate = baudRate->valueint;
    config->dataBits = dataBits->valueint;
    config->parity = parity->valueint;
    config->stopBits = stopBits->valueint;
    config->flowControl = flowControl->valueint;

    cJSON_Delete(root);
    return true;
}


// Initialize serial configuration
bool serial_config_init(void) {
    char json_str[256] = {0};   

    if(db_read(SERIAL_CONFIG_KEY, json_str, sizeof(json_str)) <= 0) {
        DBG_ERROR("Failed to read serial configuration");
        return false;
    }

    if (!parse_serial_config(json_str, &g_serial_config)) {
        DBG_ERROR("Failed to parse serial configuration");
        return false;
    }
    
    return true;
}

serial_config_t *serial_config_get(void) {
    return &g_serial_config;
}



