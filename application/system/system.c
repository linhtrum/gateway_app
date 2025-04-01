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
#include "../network/network.h"
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

// Function to handle network configuration update
static void handle_network_update(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return;
    }

    int result = db_write("network_config", (void*)json_str, strlen(json_str) + 1);
    if (result == 0) {
        DBG_INFO("Network config updated successfully");
    } else {
        DBG_ERROR("Failed to update network config");
    }
}

// Function to handle network read request
static void handle_network_read(int client_socket, const char *device_id) {
    if (!device_id || strcmp(device_id, DEVICE_ID) != 0 || client_socket < 0) {
        DBG_ERROR("Invalid device ID or client socket");
        return;
    }

    struct network_config *config = network_get_config();
    if (!config) {
        DBG_ERROR("Failed to get network config");
        return;
    }

    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON response");
        return;
    }

    cJSON_AddStringToObject(root, "type", "response");
    cJSON_AddStringToObject(root, "id", device_id);
    cJSON_AddStringToObject(root, "config", create_network_response(config->interface, config->ip, config->subnet, 
                                                                config->gateway, config->dns1, config->dns2, config->dhcp_enabled));

    char *response = cJSON_PrintUnformatted(root);
    if (response) {
        if (send(client_socket, response, strlen(response), 0) < 0) {
            DBG_ERROR("Failed to send network info response");
        }
        free(response);
    }
    cJSON_Delete(root);
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
