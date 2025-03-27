#include "mqtt.h"
#include "cJSON.h"
#include "../database/db.h"
#include "../log/log_output.h"

#define DBG_TAG "MQTT"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Static MQTT configuration
static mqtt_config_t g_mqtt_config = {0};

// Parse MQTT configuration from JSON
static bool parse_mqtt_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse MQTT config JSON");
        return false;
    }

    // Parse configuration fields
    cJSON *enabled = cJSON_GetObjectItem(root, "enabled");
    if (enabled) {
        g_mqtt_config.enabled = cJSON_IsTrue(enabled);
    }

    cJSON *version = cJSON_GetObjectItem(root, "version");
    if (version) {
        g_mqtt_config.version = version->valueint;
    }

    cJSON *client_id = cJSON_GetObjectItem(root, "clientId");
    if (client_id && client_id->valuestring) {
        strncpy(g_mqtt_config.client_id, client_id->valuestring, sizeof(g_mqtt_config.client_id) - 1);
    }

    cJSON *server_address = cJSON_GetObjectItem(root, "serverAddress");
    if (server_address && server_address->valuestring) {
        strncpy(g_mqtt_config.server_address, server_address->valuestring, sizeof(g_mqtt_config.server_address) - 1);
    }

    cJSON *port = cJSON_GetObjectItem(root, "port");
    if (port) {
        g_mqtt_config.port = port->valueint;
    }

    cJSON *keep_alive = cJSON_GetObjectItem(root, "keepAlive");
    if (keep_alive) {
        g_mqtt_config.keep_alive = keep_alive->valueint;
    }

    cJSON *reconnect_no_data = cJSON_GetObjectItem(root, "reconnectNoData");
    if (reconnect_no_data) {
        g_mqtt_config.reconnect_no_data = reconnect_no_data->valueint;
    }

    cJSON *reconnect_interval = cJSON_GetObjectItem(root, "reconnectInterval");
    if (reconnect_interval) {
        g_mqtt_config.reconnect_interval = reconnect_interval->valueint;
    }

    cJSON *clean_session = cJSON_GetObjectItem(root, "cleanSession");
    if (clean_session) {
        g_mqtt_config.clean_session = cJSON_IsTrue(clean_session);
    }

    cJSON *use_credentials = cJSON_GetObjectItem(root, "useCredentials");
    if (use_credentials) {
        g_mqtt_config.use_credentials = cJSON_IsTrue(use_credentials);
    }

    cJSON *username = cJSON_GetObjectItem(root, "username");
    if (username && username->valuestring) {
        strncpy(g_mqtt_config.username, username->valuestring, sizeof(g_mqtt_config.username) - 1);
    }

    cJSON *password = cJSON_GetObjectItem(root, "password");
    if (password && password->valuestring) {
        strncpy(g_mqtt_config.password, password->valuestring, sizeof(g_mqtt_config.password) - 1);
    }

    cJSON *enable_last_will = cJSON_GetObjectItem(root, "enableLastWill");
    if (enable_last_will) {
        g_mqtt_config.enable_last_will = cJSON_IsTrue(enable_last_will);
    }

    cJSON_Delete(root);
    return true;
}

// Convert MQTT configuration to JSON string
static char* mqtt_config_to_json(void) {
    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON object");
        return NULL;
    }

    cJSON_AddBoolToObject(root, "enabled", g_mqtt_config.enabled);
    cJSON_AddNumberToObject(root, "version", g_mqtt_config.version);
    cJSON_AddStringToObject(root, "clientId", g_mqtt_config.client_id);
    cJSON_AddStringToObject(root, "serverAddress", g_mqtt_config.server_address);
    cJSON_AddNumberToObject(root, "port", g_mqtt_config.port);
    cJSON_AddNumberToObject(root, "keepAlive", g_mqtt_config.keep_alive);
    cJSON_AddNumberToObject(root, "reconnectNoData", g_mqtt_config.reconnect_no_data);
    cJSON_AddNumberToObject(root, "reconnectInterval", g_mqtt_config.reconnect_interval);
    cJSON_AddBoolToObject(root, "cleanSession", g_mqtt_config.clean_session);
    cJSON_AddBoolToObject(root, "useCredentials", g_mqtt_config.use_credentials);
    cJSON_AddStringToObject(root, "username", g_mqtt_config.username);
    cJSON_AddStringToObject(root, "password", g_mqtt_config.password);
    cJSON_AddBoolToObject(root, "enableLastWill", g_mqtt_config.enable_last_will);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    return json_str;
}

// Initialize MQTT configuration
void mqtt_init(void) {
    char config_str[2048] = {0};
    int read_len = db_read("mqtt_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read MQTT config from database");
        return;
    }

    if (!parse_mqtt_config(config_str)) {
        DBG_ERROR("Failed to parse MQTT config");
        return;
    }

    DBG_INFO("MQTT configuration initialized: enabled=%d, server=%s:%d", 
             g_mqtt_config.enabled, g_mqtt_config.server_address, g_mqtt_config.port);
}

// Get MQTT configuration
mqtt_config_t* mqtt_get_config(void) {
    return &g_mqtt_config;
}

// Update MQTT configuration
bool mqtt_update_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    if (!parse_mqtt_config(json_str)) {
        return false;
    }

    char *config_json = mqtt_config_to_json();
    if (!config_json) {
        return false;
    }

    bool success = (db_write("mqtt_config", config_json, strlen(config_json) + 1) == 0);
    free(config_json);

    if (success) {
        DBG_INFO("MQTT configuration updated successfully");
    } else {
        DBG_ERROR("Failed to save MQTT configuration");
    }

    return success;
}

// Save MQTT configuration from JSON
bool mqtt_save_config_from_json(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    int result = db_write("mqtt_config", json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write MQTT config to database");
        return false;
    }

    return true;
}

// Check if MQTT is enabled
bool mqtt_is_enabled(void) {
    return g_mqtt_config.enabled;
}