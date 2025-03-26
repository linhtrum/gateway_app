#ifndef MANAGEMENT_H
#define MANAGEMENT_H

#include <stdbool.h>
#include <string.h>

// System management configuration structure
struct system_management_config {
    char username[64];
    char password[64];
    char ntp_server1[128];
    char ntp_server2[128];
    char ntp_server3[128];
    int timezone;
    bool ntp_enabled;
    int http_port;
    int websocket_port;
    int log_method;
};

// Initialize system management configuration
void management_init(void);

// Get current system management configuration
const struct system_management_config* management_get_config(void);

// Update system management configuration from JSON
bool management_update_config(const char *json_str);

// Convert system management configuration to JSON string
char* management_config_to_json(void);

// Save system management configuration to database
bool management_save_config(void);

// Load system management configuration from database
bool management_load_config(void);

#endif /* MANAGEMENT_H */
