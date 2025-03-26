#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <pthread.h>
#include "cJSON.h"
#include "../database/db.h"
#include "../web_server/net.h"

#define DBG_TAG "SYSTEM"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define UDP_PORT 12345
#define BUFFER_SIZE 1024
#define MAX_IP_LEN 16
#define DEFAULT_INTERFACE "eth0"
#define DEFAULT_TIMEOUT_SEC 1
#define SLEEP_INTERVAL_US 10000  // 10ms
#define MAX_MSG_SIZE 1024
#define NETWORK_UPDATE_TAG "update"
#define NETWORK_READ_TAG "read"
#define DEVICE_ID "SBIOT02"

// Global flag for graceful shutdown
static volatile int g_running = 1;

// Function to get current network information
static bool get_network_info(const char *interface, char *ip, char *subnet, char *gateway) {
    if (!ip || !subnet || !gateway) {
        DBG_ERROR("Invalid parameters");
        return false;
    }

    // Use default interface if none specified
    const char *if_name = interface ? interface : DEFAULT_INTERFACE;
    if (strlen(if_name) == 0) {
        DBG_ERROR("Empty interface name");
        return false;
    }

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
    strncpy(ifr.ifr_name, if_name, IFNAMSIZ - 1);
    if (ioctl(sockfd, SIOCGIFFLAGS, &ifr) < 0) {
        DBG_ERROR("Interface %s does not exist: %s", if_name, strerror(errno));
        close(sockfd);
        return false;
    }

    if (!(ifr.ifr_flags & IFF_UP)) {
        DBG_ERROR("Interface %s is not up", if_name);
        close(sockfd);
        return false;
    }

    // Get IP address and subnet mask
    ifr.ifr_addr.sa_family = AF_INET;

    if (ioctl(sockfd, SIOCGIFADDR, &ifr) == 0) {
        addr = (struct sockaddr_in *)&ifr.ifr_addr;
        strcpy(ip, inet_ntoa(addr->sin_addr));
        success = true;
    } else {
        DBG_ERROR("Failed to get IP address for interface %s: %s", if_name, strerror(errno));
    }

    if (ioctl(sockfd, SIOCGIFNETMASK, &ifr) == 0) {
        addr = (struct sockaddr_in *)&ifr.ifr_netmask;
        strcpy(subnet, inet_ntoa(addr->sin_addr));
    } else {
        DBG_ERROR("Failed to get subnet mask for interface %s: %s", if_name, strerror(errno));
    }

    // Get default gateway
    FILE *fp = popen("ip route | grep default | awk '{print $3}'", "r");
    if (fp) {
        if (fgets(gateway, 16, fp) != NULL) {
            // Remove newline if present
            gateway[strcspn(gateway, "\n")] = 0;
        } else {
            DBG_ERROR("Failed to get gateway for interface %s: No default route found", if_name);
        }
        pclose(fp);
    } else {
        DBG_ERROR("Failed to execute ip route command: %s", strerror(errno));
    }

    close(sockfd);
    return success;
}

// Function to parse network config JSON
static bool parse_network_config(const char *json_str, char *interface, char *ip, 
                              char *subnet, char *gateway, char *dns1, char *dns2, bool *dhcp_enabled) {
    if (!json_str || !interface || !ip || !subnet || !gateway || !dns1 || !dns2 || !dhcp_enabled) {
        DBG_ERROR("Invalid parameters");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse network config JSON");
        return false;
    }

    // Parse interface with default value
    cJSON *if_item = cJSON_GetObjectItem(root, "if");
    if (if_item && if_item->valuestring) {
        strncpy(interface, if_item->valuestring, IFNAMSIZ - 1);
        interface[IFNAMSIZ - 1] = '\0';  // Ensure null termination
    } else {
        strncpy(interface, DEFAULT_INTERFACE, IFNAMSIZ - 1);
        interface[IFNAMSIZ - 1] = '\0';
    }

    // Parse IP address
    cJSON *ip_item = cJSON_GetObjectItem(root, "ip");
    if (ip_item && ip_item->valuestring) {
        strncpy(ip, ip_item->valuestring, 16);
        ip[15] = '\0';  // Ensure null termination
    }

    // Parse subnet mask
    cJSON *sm_item = cJSON_GetObjectItem(root, "sm");
    if (sm_item && sm_item->valuestring) {
        strncpy(subnet, sm_item->valuestring, 16);
        subnet[15] = '\0';  // Ensure null termination
    }

    // Parse gateway
    cJSON *gw_item = cJSON_GetObjectItem(root, "gw");
    if (gw_item && gw_item->valuestring) {
        strncpy(gateway, gw_item->valuestring, 16);
        gateway[15] = '\0';  // Ensure null termination
    }

    // Parse DNS servers
    cJSON *d1_item = cJSON_GetObjectItem(root, "d1");
    if (d1_item && d1_item->valuestring) {
        strncpy(dns1, d1_item->valuestring, 16);
        dns1[15] = '\0';  // Ensure null termination
    }

    cJSON *d2_item = cJSON_GetObjectItem(root, "d2");
    if (d2_item && d2_item->valuestring) {
        strncpy(dns2, d2_item->valuestring, 16);
        dns2[15] = '\0';  // Ensure null termination
    }

    // Parse DHCP enabled flag
    cJSON *dh_item = cJSON_GetObjectItem(root, "dh");
    *dhcp_enabled = dh_item ? cJSON_IsTrue(dh_item) : false;

    cJSON_Delete(root);
    return true;
}

// Function to create network config response JSON
static char* create_network_response(const char *interface, const char *ip, 
                                  const char *subnet, const char *gateway,
                                  const char *dns1, const char *dns2, bool dhcp_enabled) {
    cJSON *root = cJSON_CreateObject();
    if (!root) return NULL;

    cJSON_AddStringToObject(root, "if", interface);
    cJSON_AddStringToObject(root, "ip", ip);
    cJSON_AddStringToObject(root, "sm", subnet);
    cJSON_AddStringToObject(root, "gw", gateway);
    cJSON_AddStringToObject(root, "d1", dns1);
    cJSON_AddStringToObject(root, "d2", dns2);
    cJSON_AddBoolToObject(root, "dh", dhcp_enabled);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_str;
}

static bool get_network_config(char *config_str, size_t size) {
    if (!config_str || size == 0) {
        DBG_ERROR("Invalid parameters");
        return false;
    }
    return (db_read("network_config", config_str, size) != 0);
}

// Function to handle network configuration request
static void handle_network_config(int client_socket) {
    char interface[IFNAMSIZ] = {0};
    char ip[16] = {0};
    char subnet[16] = {0};
    char gateway[16] = {0};
    char dns1[16] = {0};
    char dns2[16] = {0};
    bool dhcp_enabled = false;
    char *response = NULL;
    char config_str[MAX_MSG_SIZE] = {0};

    // Get network config from database
    if (!get_network_config(config_str, sizeof(config_str))) {
        DBG_ERROR("Failed to get network config from database");
        return;
    }

    // Parse network config
    if (!parse_network_config(config_str, interface, ip, subnet, gateway, dns1, dns2, &dhcp_enabled)) {
        DBG_ERROR("Failed to parse network config");
        return;
    }

    // If DHCP is enabled, get current network info
    if (dhcp_enabled) {
        char current_ip[16] = {0};
        char current_subnet[16] = {0};
        char current_gateway[16] = {0};

        if (get_network_info(interface, current_ip, current_subnet, current_gateway)) {
            response = create_network_response(interface, current_ip, current_subnet, 
                                            current_gateway, dns1, dns2, dhcp_enabled);
        } else {
            DBG_ERROR("Failed to get current network info");
            return;
        }
    } else {
        // Use static configuration
        response = create_network_response(interface, ip, subnet, gateway, dns1, dns2, dhcp_enabled);
    }

    if (response) {
        // Send response
        if (send(client_socket, response, strlen(response), 0) < 0) {
            DBG_ERROR("Failed to send network config response");
        }
        free(response);
    }
}

// Function to handle network configuration update
static void handle_network_update(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return;
    }

    // Parse JSON message
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse network update JSON");
        return;
    }

    // Get network config
    cJSON *config = cJSON_GetObjectItem(root, "config");
    if (!config) {
        DBG_ERROR("Missing network configuration");
        cJSON_Delete(root);
        return;
    }

    // Convert config to string
    char *config_str = cJSON_PrintUnformatted(config);
    if (!config_str) {
        DBG_ERROR("Failed to convert config to string");
        cJSON_Delete(root);
        return;
    }

    // Write config to database
    if (db_write("network_config", config_str, strlen(config_str) + 1) != 0) {
        DBG_ERROR("Failed to write network config to database");
        free(config_str);
        cJSON_Delete(root);
        return;
    }

    DBG_INFO("Network configuration saved to database");
    free(config_str);
    cJSON_Delete(root);
}

// Function to handle network read request
static void handle_network_read(int client_socket, const char *device_id) {
    if (!device_id) {
        DBG_ERROR("Invalid device ID");
        return;
    }

    // Get current network information
    char interface[IFNAMSIZ] = {0};
    char ip[16] = {0};
    char subnet[16] = {0};
    char gateway[16] = {0};
    char dns1[16] = {0};
    char dns2[16] = {0};
    bool dhcp_enabled = false;
    char config_str[MAX_MSG_SIZE] = {0};

    // Get network config from database
    if (!get_network_config(config_str, sizeof(config_str))) {
        DBG_ERROR("Failed to get network config from database");
        return;
    }

    // Parse network config
    if (!parse_network_config(config_str, interface, ip, subnet, gateway, dns1, dns2, &dhcp_enabled)) {
        DBG_ERROR("Failed to parse network config");
        return;
    }

    // If DHCP is enabled, get current network info
    if (dhcp_enabled) {
        char current_ip[16] = {0};
        char current_subnet[16] = {0};
        char current_gateway[16] = {0};

        if (!get_network_info(interface, current_ip, current_subnet, current_gateway)) {
            DBG_ERROR("Failed to get current network info");
            return;
        }

        // Create response with current network info
        cJSON *root = cJSON_CreateObject();
        if (!root) {
            DBG_ERROR("Failed to create JSON response");
            return;
        }

        cJSON_AddStringToObject(root, "type", "response");
        cJSON_AddStringToObject(root, "id", device_id);
        cJSON_AddStringToObject(root, "config", create_network_response(interface, current_ip, current_subnet, 
                                                                      current_gateway, dns1, dns2, dhcp_enabled));

        char *response = cJSON_PrintUnformatted(root);
        if (response) {
            if (send(client_socket, response, strlen(response), 0) < 0) {
                DBG_ERROR("Failed to send network info response");
            }
            free(response);
        }
        cJSON_Delete(root);
    } else {
        // Create response with static configuration
        cJSON *root = cJSON_CreateObject();
        if (!root) {
            DBG_ERROR("Failed to create JSON response");
            return;
        }

        cJSON_AddStringToObject(root, "type", "response");
        cJSON_AddStringToObject(root, "id", device_id);
        cJSON_AddStringToObject(root, "config", create_network_response(interface, ip, subnet, 
                                                                      gateway, dns1, dns2, dhcp_enabled));

        char *response = cJSON_PrintUnformatted(root);
        if (response) {
            if (send(client_socket, response, strlen(response), 0) < 0) {
                DBG_ERROR("Failed to send network info response");
            }
            free(response);
        }
        cJSON_Delete(root);
    }
}

// Function to handle socket messages
static void handle_socket_message(int client_socket, const char *message) {
    if (!message) return;

    // Try to parse as JSON
    cJSON *root = cJSON_Parse(message);
    if (!root) return;

    // Check message type and device ID
    cJSON *type = cJSON_GetObjectItem(root, "type");
    cJSON *id = cJSON_GetObjectItem(root, "id");
    
    if (!type || !type->valuestring || !id || !id->valuestring || 
        strcmp(id->valuestring, DEVICE_ID) != 0) {
        cJSON_Delete(root);
        return;
    }

    // Handle message based on type
    if (strcmp(type->valuestring, NETWORK_UPDATE_TAG) == 0) {
        handle_network_update(message);
    }
    else if (strcmp(type->valuestring, NETWORK_READ_TAG) == 0) {
        handle_network_read(client_socket, id->valuestring);
    }

    cJSON_Delete(root);
}

static void cleanup_socket(int sock) {
    if (sock >= 0) {
        shutdown(sock, SHUT_RDWR);
        close(sock);
    }
}

static int init_udp_socket(void) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        DBG_ERROR("Socket creation failed: %s", strerror(errno));
        return -1;
    }

    // Enable address reuse
    int reuse = 1;
    if (setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) < 0) {
        DBG_ERROR("Set SO_REUSEADDR failed: %s", strerror(errno));
        cleanup_socket(sock);
        return -1;
    }

    // Set receive timeout
    struct timeval tv = {
        .tv_sec = DEFAULT_TIMEOUT_SEC,
        .tv_usec = 0
    };
    if (setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv)) < 0) {
        DBG_ERROR("Set SO_RCVTIMEO failed: %s", strerror(errno));
        cleanup_socket(sock);
        return -1;
    }

    // Configure and bind socket
    struct sockaddr_in server_addr = {
        .sin_family = AF_INET,
        .sin_addr.s_addr = INADDR_ANY,
        .sin_port = htons(UDP_PORT)
    };

    if (bind(sock, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        DBG_ERROR("Bind failed: %s", strerror(errno));
        cleanup_socket(sock);
        return -1;
    }

    return sock;
}

static void *udp_server_thread(void *arg) {
    int sock = init_udp_socket();
    if (sock < 0) {
        return NULL;
    }

    struct sockaddr_in client_addr;
    char buffer[BUFFER_SIZE];
    socklen_t addr_len = sizeof(client_addr);

    DBG_INFO("UDP server started on port %d", UDP_PORT);

    while (g_running) {
        int recv_len = recvfrom(sock, buffer, BUFFER_SIZE-1, 0,
                               (struct sockaddr*)&client_addr, &addr_len);
        
        if (recv_len > 0) {
            buffer[recv_len] = '\0';
            DBG_INFO("Received message: %s from %s", buffer, inet_ntoa(client_addr.sin_addr));
            handle_socket_message(sock, buffer);
        } else if (recv_len < 0) {
            if (errno != EAGAIN && errno != EWOULDBLOCK) {
                DBG_ERROR("recvfrom failed: %s", strerror(errno));
            }
            usleep(SLEEP_INTERVAL_US);
        }
    }

    cleanup_socket(sock);
    return NULL;
}

void stop_udp_server(void) {
    g_running = 0;
}

void start_udp_server(void) {
    pthread_t thread;
    pthread_attr_t attr;
    
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    
    int ret = pthread_create(&thread, &attr, udp_server_thread, NULL);
    if (ret != 0) {
        DBG_ERROR("Failed to create UDP server thread: %s", strerror(ret));
    }
    
    pthread_attr_destroy(&attr);
}
