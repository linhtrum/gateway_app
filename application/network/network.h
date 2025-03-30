#ifndef NETWORK_H
#define NETWORK_H

#include <stdbool.h>
#include <string.h>
#include <net/if.h>

// Network configuration structure
struct network_config {
    char interface[IFNAMSIZ];
    char ip[16];
    char subnet[16];
    char gateway[16];
    char dns1[16];
    char dns2[16];
    bool dhcp_enabled;
    int network_priority;
    int sim_mode;
    char apn[16];
    char apn_username[16];
    char apn_password[16];
    int auth_type;
};

// Initialize network configuration
void network_init(void);

// Get current network configuration
const struct network_config* network_get_config(void);

// Update network configuration from JSON
bool network_parse_config(const char *json_str);

// Convert network configuration to JSON string
char* network_config_to_json(void);

// Get current network information from system
bool network_get_current_info(void);

// Save network configuration from JSON
bool network_save_config_from_json(const char *json_str);

// Set static IP configuration
bool network_set_static_ip(const char *interface, const char *ip, const char *subnet, 
                          const char *gateway, const char *dns1, const char *dns2);

// Set dynamic IP configuration (DHCP)
bool network_set_dynamic_ip(const char *interface);

// Get DHCP state from network configuration
bool network_get_dhcp_state(void);

#endif /* NETWORK_H */
