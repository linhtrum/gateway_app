#include "socket.h"
#include "debug.h"
#include <string.h>
#include <stdlib.h>
#include <cJSON.h>

// Maximum number of socket configurations
#define MAX_SOCKET_PORTS 2

// Static socket configuration array
static socket_config_t g_socket_configs[MAX_SOCKET_PORTS] = {0};

// Get socket configuration by index
static socket_config_t* get_socket_config(int index) {
    if (index < 0 || index >= MAX_SOCKET_PORTS) {
        return NULL;
    }
    return &g_socket_configs[index];
}

// Parse socket configuration from JSON string
bool socket_parse_config(const char *json_str, socket_config_t *config) {
    if (!json_str || !config) {
        DBG_ERROR("Invalid parameters");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse socket config JSON");
        return false;
    }

    // Parse configuration fields
    cJSON *enabled = cJSON_GetObjectItem(root, "enabled");
    if (enabled) {
        config->enabled = cJSON_IsTrue(enabled);
    }

    cJSON *working_mode = cJSON_GetObjectItem(root, "workingMode");
    if (working_mode) {
        config->working_mode = (socket_working_mode_t)working_mode->valueint;
    }

    cJSON *remote_server_addr = cJSON_GetObjectItem(root, "remoteServerAddr");
    if (remote_server_addr && remote_server_addr->valuestring) {
        strncpy(config->remote_server_addr, remote_server_addr->valuestring, 
                sizeof(config->remote_server_addr) - 1);
    }

    cJSON *local_port = cJSON_GetObjectItem(root, "localPort");
    if (local_port) {
        config->local_port = (uint16_t)local_port->valueint;
    }

    cJSON *remote_port = cJSON_GetObjectItem(root, "remotePort");
    if (remote_port) {
        config->remote_port = (uint16_t)remote_port->valueint;
    }

    cJSON *sock_mode = cJSON_GetObjectItem(root, "sockMode");
    if (sock_mode) {
        config->sock_mode = (socket_mode_t)sock_mode->valueint;
    }

    cJSON *max_sockets = cJSON_GetObjectItem(root, "maxSockets");
    if (max_sockets) {
        config->max_sockets = (uint8_t)max_sockets->valueint;
    }

    cJSON *udp_check_port = cJSON_GetObjectItem(root, "udpCheckPort");
    if (udp_check_port) {
        config->udp_check_port = cJSON_IsTrue(udp_check_port);
    }

    cJSON *heartbeat_type = cJSON_GetObjectItem(root, "heartbeatType");
    if (heartbeat_type) {
        config->heartbeat_type = (heartbeat_type_t)heartbeat_type->valueint;
    }

    cJSON *heartbeat_packet_type = cJSON_GetObjectItem(root, "heartbeatPacketType");
    if (heartbeat_packet_type) {
        config->heartbeat_packet_type = (packet_type_t)heartbeat_packet_type->valueint;
    }

    cJSON *heartbeat_packet = cJSON_GetObjectItem(root, "heartbeatPacket");
    if (heartbeat_packet && heartbeat_packet->valuestring) {
        strncpy(config->heartbeat_packet, heartbeat_packet->valuestring, 
                sizeof(config->heartbeat_packet) - 1);
    }

    cJSON *registration_type = cJSON_GetObjectItem(root, "registrationType");
    if (registration_type) {
        config->registration_type = (uint8_t)registration_type->valueint;
    }

    cJSON *registration_packet_type = cJSON_GetObjectItem(root, "registrationPacketType");
    if (registration_packet_type) {
        config->registration_packet_type = (packet_type_t)registration_packet_type->valueint;
    }

    cJSON *registration_packet = cJSON_GetObjectItem(root, "registrationPacket");
    if (registration_packet && registration_packet->valuestring) {
        strncpy(config->registration_packet, registration_packet->valuestring, 
                sizeof(config->registration_packet) - 1);
    }

    cJSON *registration_packet_location = cJSON_GetObjectItem(root, "registrationPacketLocation");
    if (registration_packet_location) {
        config->registration_packet_location = (uint8_t)registration_packet_location->valueint;
    }

    cJSON *http_method = cJSON_GetObjectItem(root, "httpMethod");
    if (http_method) {
        config->http_method = (http_method_t)http_method->valueint;
    }

    cJSON *ssl_protocol = cJSON_GetObjectItem(root, "sslProtocol");
    if (ssl_protocol) {
        config->ssl_protocol = (ssl_protocol_t)ssl_protocol->valueint;
    }

    cJSON *ssl_verify_option = cJSON_GetObjectItem(root, "sslVerifyOption");
    if (ssl_verify_option) {
        config->ssl_verify_option = (ssl_verify_option_t)ssl_verify_option->valueint;
    }

    cJSON *server_ca = cJSON_GetObjectItem(root, "serverCA");
    if (server_ca && server_ca->valuestring) {
        strncpy(config->server_ca, server_ca->valuestring, 
                sizeof(config->server_ca) - 1);
    }

    cJSON *client_certificate = cJSON_GetObjectItem(root, "clientCertificate");
    if (client_certificate && client_certificate->valuestring) {
        strncpy(config->client_certificate, client_certificate->valuestring, 
                sizeof(config->client_certificate) - 1);
    }

    cJSON *client_key = cJSON_GetObjectItem(root, "clientKey");
    if (client_key && client_key->valuestring) {
        strncpy(config->client_key, client_key->valuestring, 
                sizeof(config->client_key) - 1);
    }

    cJSON *http_url = cJSON_GetObjectItem(root, "httpUrl");
    if (http_url && http_url->valuestring) {
        strncpy(config->http_url, http_url->valuestring, 
                sizeof(config->http_url) - 1);
    }

    cJSON *http_header = cJSON_GetObjectItem(root, "httpHeader");
    if (http_header && http_header->valuestring) {
        strncpy(config->http_header, http_header->valuestring, 
                sizeof(config->http_header) - 1);
    }

    cJSON *remove_header = cJSON_GetObjectItem(root, "removeHeader");
    if (remove_header) {
        config->remove_header = cJSON_IsTrue(remove_header);
    }

    cJSON *modbus_poll = cJSON_GetObjectItem(root, "modbusPoll");
    if (modbus_poll) {
        config->modbus_poll = cJSON_IsTrue(modbus_poll);
    }

    cJSON *modbus_tcp_exception = cJSON_GetObjectItem(root, "modbusTcpException");
    if (modbus_tcp_exception) {
        config->modbus_tcp_exception = cJSON_IsTrue(modbus_tcp_exception);
    }

    cJSON *short_connection_duration = cJSON_GetObjectItem(root, "shortConnectionDuration");
    if (short_connection_duration) {
        config->short_connection_duration = (uint16_t)short_connection_duration->valueint;
    }

    cJSON *reconnection_period = cJSON_GetObjectItem(root, "reconnectionPeriod");
    if (reconnection_period) {
        config->reconnection_period = (uint16_t)reconnection_period->valueint;
    }

    cJSON *response_timeout = cJSON_GetObjectItem(root, "responseTimeout");
    if (response_timeout) {
        config->response_timeout = (uint16_t)response_timeout->valueint;
    }

    cJSON *exceed_mode = cJSON_GetObjectItem(root, "execeedMode");
    if (exceed_mode) {
        config->exceed_mode = (exceed_mode_t)exceed_mode->valueint;
    }

    cJSON *heartbeat_interval = cJSON_GetObjectItem(root, "heartbeatInterval");
    if (heartbeat_interval) {
        config->heartbeat_interval = (uint16_t)heartbeat_interval->valueint;
    }

    cJSON_Delete(root);
    return true;
}

// Initialize socket configuration
void socket_init(void) {
    // Initialize first port
    char config_str[4096] = {0};
    int read_len = db_read("socket1_config", config_str, sizeof(config_str));
    if (read_len > 0) {
        if (socket_parse_config(config_str, &g_socket_configs[0])) {
            DBG_INFO("Socket port 1 configuration initialized");
        }
        else {
            DBG_ERROR("Failed to parse socket port 1 configuration");
        }
    }

    // Initialize second port
    read_len = db_read("socket2_config", config_str, sizeof(config_str));
    if (read_len > 0) {
        if (socket_parse_config(config_str, &g_socket_configs[1])) {
            DBG_INFO("Socket port 2 configuration initialized");
        }
        else {
            DBG_ERROR("Failed to parse socket port 2 configuration");
        }
    }
}

// Get socket configuration
socket_config_t* socket_get_config(int port_index) {
    return get_socket_config(port_index);
}

