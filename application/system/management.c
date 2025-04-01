#include "management.h"
#include <stdio.h>
#include <stdlib.h>
#include "../database/db.h"
#include "cJSON.h"

#define DBG_TAG "MANAGEMENT"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Global instance of system management config
static struct system_management_config g_system_config = {0};

// Get current system management configuration
const struct system_management_config* management_get_config(void) {
    return &g_system_config;
}

int management_get_http_port(void) {
    return g_system_config.http_port;
}

int management_get_websocket_port(void) {
    return g_system_config.websocket_port;
}

int management_get_log_method(void) {
    return g_system_config.log_method;
}

// Update system management configuration from JSON
static bool parse_management_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse JSON");
        return false;
    }

    // Parse username
    cJSON *username = cJSON_GetObjectItem(root, "username");
    if (username) {
        strncpy(g_system_config.username, username->valuestring, sizeof(g_system_config.username) - 1);
        g_system_config.username[sizeof(g_system_config.username) - 1] = '\0';
    }

    // Parse password
    cJSON *password = cJSON_GetObjectItem(root, "password");
    if (password) {
        strncpy(g_system_config.password, password->valuestring, sizeof(g_system_config.password) - 1);
        g_system_config.password[sizeof(g_system_config.password) - 1] = '\0';
    }

    // Parse NTP servers
    cJSON *server1 = cJSON_GetObjectItem(root, "server1");
    if (server1) {
        strncpy(g_system_config.ntp_server1, server1->valuestring, sizeof(g_system_config.ntp_server1) - 1);
        g_system_config.ntp_server1[sizeof(g_system_config.ntp_server1) - 1] = '\0';
    }

    cJSON *server2 = cJSON_GetObjectItem(root, "server2");
    if (server2) {
        strncpy(g_system_config.ntp_server2, server2->valuestring, sizeof(g_system_config.ntp_server2) - 1);
        g_system_config.ntp_server2[sizeof(g_system_config.ntp_server2) - 1] = '\0';
    }

    cJSON *server3 = cJSON_GetObjectItem(root, "server3");
    if (server3) {
        strncpy(g_system_config.ntp_server3, server3->valuestring, sizeof(g_system_config.ntp_server3) - 1);
        g_system_config.ntp_server3[sizeof(g_system_config.ntp_server3) - 1] = '\0';
    }

    // Parse timezone
    cJSON *timezone = cJSON_GetObjectItem(root, "timezone");
    if (timezone) {
        g_system_config.timezone = timezone->valueint;
    }

    // Parse NTP enabled status
    cJSON *enabled = cJSON_GetObjectItem(root, "enabled");
    if (enabled) {
        g_system_config.ntp_enabled = enabled->valueint != 0;
    }
    else {
        g_system_config.ntp_enabled = false;
    }

    // Parse HTTP port
    cJSON *hport = cJSON_GetObjectItem(root, "hport");
    if (hport) {
        g_system_config.http_port = hport->valueint;
    }

    // Parse WebSocket port
    cJSON *wport = cJSON_GetObjectItem(root, "wport");
    if (wport) {
        g_system_config.websocket_port = wport->valueint;
    }

    // Parse log method
    cJSON *logMethod = cJSON_GetObjectItem(root, "logMethod");
    if (logMethod) {
        g_system_config.log_method = logMethod->valueint;
    }

    cJSON_Delete(root);
    return true;
}

// Initialize system management configuration
void management_init(void) {
    char config_str[4096] = {0};

    // Read config from database
    int read_len = db_read("system_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read system management config from database");
        return;
    }

    // Update configuration from JSON
    bool success = parse_management_config(config_str);

    if (!success) {
        DBG_ERROR("Failed to update system management config from JSON");
        return;
    }

    DBG_INFO("System management config initialized successfully");
}

