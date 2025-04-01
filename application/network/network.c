#include "network.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include "cJSON.h"
#include "../database/db.h"
#include "../log/log_buffer.h"
#include "../log/log_output.h"

#define DBG_TAG "NETWORK"
#define DBG_LVL LOG_INFO
#include "dbg.h"

static struct network_config g_network_config = {0};

// Initialize network configuration with default values
void network_init(void) {
    char config_str[4096] = {0};
    if (db_read("network_config", config_str, sizeof(config_str)) <= 0) {
        DBG_ERROR("Failed to read network config from database");
        return;
    }

    if (network_parse_config(config_str)) {
        DBG_INFO("Network config parsed successfully");
    }
    else {
        DBG_ERROR("Failed to parse network config");
    }
    // if(g_network_config.dhcp_enabled) {
    //     network_set_dynamic_ip(g_network_config.interface);
    // }
    // else {
    //     network_set_static_ip(g_network_config.interface, g_network_config.ip, g_network_config.subnet, g_network_config.gateway, g_network_config.dns1, g_network_config.dns2);
    // }
    network_get_current_info();
}

// Get current network configuration
const struct network_config* network_get_config(void) {
    return &g_network_config;
}

// Get DHCP state from network configuration
bool network_get_dhcp_state(void) {
    return g_network_config.dhcp_enabled;
}

// Update network configuration from JSON
bool network_parse_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse network config JSON");
        return false;
    }

    // Parse network priority
    cJSON *np_item = cJSON_GetObjectItem(root, "np");
    if (np_item && np_item->valueint) {
        g_network_config.network_priority = np_item->valueint;
    }

    // Parse interface
    cJSON *if_item = cJSON_GetObjectItem(root, "if");
    if (if_item && if_item->valuestring) {
        strncpy(g_network_config.interface, if_item->valuestring, IFNAMSIZ - 1);
        g_network_config.interface[IFNAMSIZ - 1] = '\0';
    }
    else {
        strncpy(g_network_config.interface, "eth0", IFNAMSIZ - 1);
        g_network_config.interface[IFNAMSIZ - 1] = '\0';
    }

    // Parse IP address
    cJSON *ip_item = cJSON_GetObjectItem(root, "ip");
    if (ip_item && ip_item->valuestring) {
        strncpy(g_network_config.ip, ip_item->valuestring, 16);
        g_network_config.ip[15] = '\0';
    }

    // Parse subnet mask
    cJSON *sm_item = cJSON_GetObjectItem(root, "sm");
    if (sm_item && sm_item->valuestring) {
        strncpy(g_network_config.subnet, sm_item->valuestring, 16);
        g_network_config.subnet[15] = '\0';
    }

    // Parse gateway
    cJSON *gw_item = cJSON_GetObjectItem(root, "gw");
    if (gw_item && gw_item->valuestring) {
        strncpy(g_network_config.gateway, gw_item->valuestring, 16);
        g_network_config.gateway[15] = '\0';
    }

    // Parse DNS servers
    cJSON *d1_item = cJSON_GetObjectItem(root, "d1");
    if (d1_item && d1_item->valuestring) {
        strncpy(g_network_config.dns1, d1_item->valuestring, 16);
        g_network_config.dns1[15] = '\0';
    }

    cJSON *d2_item = cJSON_GetObjectItem(root, "d2");
    if (d2_item && d2_item->valuestring) {
        strncpy(g_network_config.dns2, d2_item->valuestring, 16);
        g_network_config.dns2[15] = '\0';
    }

    // Parse DHCP enabled flag
    cJSON *dh_item = cJSON_GetObjectItem(root, "dh");
    g_network_config.dhcp_enabled = dh_item ? cJSON_IsTrue(dh_item) : false;

    // Parse SIM mode
    cJSON *mo_item = cJSON_GetObjectItem(root, "mo");
    if (mo_item && mo_item->valueint) {
        g_network_config.sim_mode = mo_item->valueint;
    }

    // Parse APN
    cJSON *apn_item = cJSON_GetObjectItem(root, "apn");
    if (apn_item && apn_item->valuestring) {
        strncpy(g_network_config.apn, apn_item->valuestring, 16);
        g_network_config.apn[15] = '\0';
    }
    
    // Parse APN username
    cJSON *au_item = cJSON_GetObjectItem(root, "au");
    if (au_item && au_item->valuestring) {
        strncpy(g_network_config.apn_username, au_item->valuestring, 16);
        g_network_config.apn_username[15] = '\0';
    }

    // Parse APN password
    cJSON *ap_item = cJSON_GetObjectItem(root, "ap");
    if (ap_item && ap_item->valuestring) {
        strncpy(g_network_config.apn_password, ap_item->valuestring, 16);
        g_network_config.apn_password[15] = '\0';
    }
    
    // Parse authentication type
    cJSON *at_item = cJSON_GetObjectItem(root, "at");
    if (at_item && at_item->valueint) {
        g_network_config.auth_type = at_item->valueint;
    }

    cJSON_Delete(root);
    return true;
}

// Convert network configuration to JSON string
char* network_config_to_json(void) {
    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON object");
        return NULL;
    }
    cJSON_AddNumberToObject(root, "np", g_network_config.network_priority);
    cJSON_AddStringToObject(root, "if", g_network_config.interface);
    cJSON_AddStringToObject(root, "ip", g_network_config.ip);
    cJSON_AddStringToObject(root, "sm", g_network_config.subnet);
    cJSON_AddStringToObject(root, "gw", g_network_config.gateway);
    cJSON_AddStringToObject(root, "d1", g_network_config.dns1);
    cJSON_AddStringToObject(root, "d2", g_network_config.dns2);
    cJSON_AddBoolToObject(root, "dh", g_network_config.dhcp_enabled);
    cJSON_AddNumberToObject(root, "mo", g_network_config.sim_mode);
    cJSON_AddStringToObject(root, "apn", g_network_config.apn);
    cJSON_AddStringToObject(root, "au", g_network_config.apn_username);
    cJSON_AddStringToObject(root, "ap", g_network_config.apn_password);
    cJSON_AddNumberToObject(root, "at", g_network_config.auth_type);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_str;
}

// Get current network information from system
bool network_get_current_info(void) {
    struct ifreq ifr;
    struct sockaddr_in *addr;
    int sockfd;
    bool success = false;

    // Create socket for ioctl
    sockfd = socket(AF_INET, SOCK_DGRAM, 0);
    if (sockfd < 0) {
        DBG_ERROR("Failed to create socket for network info: %s", strerror(errno));
        return false;
    }

    // Check if interface exists and is up
    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, g_network_config.interface, IFNAMSIZ - 1);
    if (ioctl(sockfd, SIOCGIFFLAGS, &ifr) < 0) {
        DBG_ERROR("Interface %s does not exist: %s", g_network_config.interface, strerror(errno));
        close(sockfd);
        return false;
    }

    if (!(ifr.ifr_flags & IFF_UP)) {
        DBG_ERROR("Interface %s is not up", g_network_config.interface);
        close(sockfd);
        return false;
    }

    // Get IP address and subnet mask
    ifr.ifr_addr.sa_family = AF_INET;

    if (ioctl(sockfd, SIOCGIFADDR, &ifr) == 0) {
        addr = (struct sockaddr_in *)&ifr.ifr_addr;
        strcpy(g_network_config.ip, inet_ntoa(addr->sin_addr));
        success = true;
    } else {
        DBG_ERROR("Failed to get IP address for interface %s: %s", g_network_config.interface, strerror(errno));
    }

    if (ioctl(sockfd, SIOCGIFNETMASK, &ifr) == 0) {
        addr = (struct sockaddr_in *)&ifr.ifr_netmask;
        strcpy(g_network_config.subnet, inet_ntoa(addr->sin_addr));
    } else {
        DBG_ERROR("Failed to get subnet mask for interface %s: %s", g_network_config.interface, strerror(errno));
    }

    // Get default gateway
    FILE *fp = popen("ip route | grep default | awk '{print $3}'", "r");
    if (fp) {
        if (fgets(g_network_config.gateway, 16, fp) != NULL) {
            // Remove newline if present
            g_network_config.gateway[strcspn(g_network_config.gateway, "\n")] = 0;
        } else {
            DBG_ERROR("Failed to get gateway for interface %s: No default route found", g_network_config.interface);
        }
        pclose(fp);
    } else {
        DBG_ERROR("Failed to execute ip route command: %s", strerror(errno));
    }

    // Get DHCP state from systemd network configuration
    FILE *network_fp = fopen("/lib/systemd/network/80-wired.network", "r");
    if (network_fp) {
        char line[256];
        bool in_network_section = false;
        g_network_config.dhcp_enabled = false;  // Default to disabled
        
        while (fgets(line, sizeof(line), network_fp)) {
            // Remove trailing whitespace
            line[strcspn(line, "\r\n")] = 0;
            
            // Check for [Network] section
            if (strcmp(line, "[Network]") == 0) {
                in_network_section = true;
            } else if (line[0] == '[' && line[strlen(line)-1] == ']') {
                in_network_section = false;
            }
            
            // In [Network] section, check for DHCP setting
            if (in_network_section) {
                if (strcmp(line, "DHCP=yes") == 0) {
                    g_network_config.dhcp_enabled = true;
                    break;
                }
                // Any other DHCP setting (DHCP=no, DHCP=ipv4, etc) means DHCP is disabled
            }
        }
        fclose(network_fp);
        DBG_INFO("DHCP state: %s", g_network_config.dhcp_enabled ? "enabled" : "disabled");
    } else {
        DBG_ERROR("Failed to read network configuration file: %s", strerror(errno));
        g_network_config.dhcp_enabled = false;  // Default to disabled if file not found
    }

    // Get DNS servers from /etc/resolv.conf
    FILE *resolv_fp = fopen("/etc/resolv.conf", "r");
    if (resolv_fp) {
        char line[256];
        bool found_dns1 = false;
        bool found_dns2 = false;
        
        // Initialize DNS servers to empty strings
        g_network_config.dns1[0] = '\0';
        g_network_config.dns2[0] = '\0';
        
        while (fgets(line, sizeof(line), resolv_fp)) {
            // Remove trailing whitespace
            line[strcspn(line, "\r\n")] = 0;
            
            // Look for nameserver entries
            if (strncmp(line, "nameserver", 10) == 0) {
                char *dns = line + 10;  // Skip "nameserver"
                // Skip leading whitespace
                while (*dns == ' ') dns++;
                
                if (!found_dns1) {
                    // First DNS server
                    strncpy(g_network_config.dns1, dns, sizeof(g_network_config.dns1) - 1);
                    g_network_config.dns1[sizeof(g_network_config.dns1) - 1] = '\0';
                    found_dns1 = true;
                } else if (!found_dns2) {
                    // Second DNS server
                    strncpy(g_network_config.dns2, dns, sizeof(g_network_config.dns2) - 1);
                    g_network_config.dns2[sizeof(g_network_config.dns2) - 1] = '\0';
                    found_dns2 = true;
                    break;  // We only need two DNS servers
                }
            }
        }
        fclose(resolv_fp);
        
        if (found_dns1 || found_dns2) {
            DBG_INFO("DNS servers: %s, %s", 
                    g_network_config.dns1[0] ? g_network_config.dns1 : "none",
                    g_network_config.dns2[0] ? g_network_config.dns2 : "none");
        } else {
            DBG_ERROR("No DNS servers found in resolv.conf");
        }
    } else {
        DBG_ERROR("Failed to read resolv.conf: %s", strerror(errno));
        // Initialize DNS servers to empty strings
        g_network_config.dns1[0] = '\0';
        g_network_config.dns2[0] = '\0';
    }

    close(sockfd);
    return success;
}

// Set static IP configuration
bool network_set_static_ip(const char *interface, const char *ip, const char *subnet, 
                          const char *gateway, const char *dns1, const char *dns2) {
    if (!interface || !ip || !subnet) {
        DBG_ERROR("Invalid parameters for static IP configuration");
        return false;
    }

    // Create network configuration file
    FILE *fp = fopen("/lib/systemd/network/80-wired.network", "w");
    if (!fp) {
        DBG_ERROR("Failed to open network config file: %s", strerror(errno));
        return false;
    }

    // Write [Match] section
    fprintf(fp, "[Match]\n");
    fprintf(fp, "Name=%s\n", interface);
    fprintf(fp, "KernelCommandLine=!nfsroot\n\n");

    // Write [Network] section
    fprintf(fp, "[Network]\n");
    
    // Convert subnet mask to CIDR notation
    char *netmask = strdup(subnet);
    if (!netmask) {
        fclose(fp);
        DBG_ERROR("Failed to allocate memory for netmask");
        return false;
    }

    unsigned int mask[4];
    int cidr = 0;
    
    if (sscanf(netmask, "%u.%u.%u.%u", &mask[0], &mask[1], &mask[2], &mask[3]) == 4) {
        // Calculate CIDR by counting consecutive 1s from left to right
        for (int i = 0; i < 4; i++) {
            unsigned int m = mask[i];
            for (int j = 0; j < 8; j++) {
                if (m & 0x80) {
                    cidr++;
                } else {
                    // If we find a 0, we should stop counting
                    goto done_cidr;
                }
                m <<= 1;
            }
        }
    }
done_cidr:
    free(netmask);

    // Write IP address with CIDR
    fprintf(fp, "Address=%s/%d\n", ip, cidr);

    // Write gateway if provided
    if (gateway && gateway[0] != '\0') {
        fprintf(fp, "Gateway=%s\n", gateway);
    }

    // Write DNS servers if provided
    if (dns1 && dns1[0] != '\0') {
        fprintf(fp, "DNS=%s\n", dns1);
    }
    if (dns2 && dns2[0] != '\0') {
        fprintf(fp, "DNS=%s\n", dns2);
    }
    fprintf(fp, "\n");

    // Write DHCP section
    fprintf(fp, "[DHCP]\n");
    fprintf(fp, "RouteMetric=10\n");
    fprintf(fp, "ClientIdentifier=mac\n");

    fclose(fp);

    // Restart network service to apply changes
    int ret = system("systemctl restart systemd-networkd");
    if (ret != 0) {
        DBG_ERROR("Failed to restart network service");
        return false;
    }

    // Wait for network to be up (max 5 seconds)
    int retries = 5;
    while (retries > 0) {
        ret = system("ip link show eth0 | grep -q 'state UP'");
        if (ret == 0) {
            DBG_INFO("Network interface %s is up with static IP", interface);
            return true;
        }
        sleep(1);
        retries--;
    }

    DBG_ERROR("Network interface %s failed to come up", interface);
    return false;
}

// Set dynamic IP configuration (DHCP)
bool network_set_dynamic_ip(const char *interface) {
    if (!interface) {
        DBG_ERROR("Invalid interface name");
        return false;
    }

    // Create network configuration file
    FILE *fp = fopen("/lib/systemd/network/80-wired.network", "w");
    if (!fp) {
        DBG_ERROR("Failed to open network config file: %s", strerror(errno));
        return false;
    }

    // Write [Match] section
    fprintf(fp, "[Match]\n");
    fprintf(fp, "Name=%s\n", interface);
    fprintf(fp, "KernelCommandLine=!nfsroot\n\n");

    // Write [Network] section with DHCP enabled
    fprintf(fp, "[Network]\n");
    fprintf(fp, "DHCP=yes\n\n");

    // Write DHCP section
    fprintf(fp, "[DHCP]\n");
    fprintf(fp, "RouteMetric=10\n");
    fprintf(fp, "ClientIdentifier=mac\n");

    fclose(fp);

    // Restart network service to apply changes
    int ret = system("systemctl restart systemd-networkd");
    if (ret != 0) {
        DBG_ERROR("Failed to restart network service");
        return false;
    }

    // Wait for network to be up (max 5 seconds)
    int retries = 5;
    while (retries > 0) {
        ret = system("ip link show eth0 | grep -q 'state UP'");
        if (ret == 0) {
            DBG_INFO("Network interface %s is up with DHCP", interface);
            return true;
        }
        sleep(1);
        retries--;
    }

    DBG_ERROR("Network interface %s failed to come up", interface);
    return false;
}



