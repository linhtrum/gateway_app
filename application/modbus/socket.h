#ifndef SOCKET_H
#define SOCKET_H

#include <stdint.h>
#include <stdbool.h>
#include "db.h"
#include <pthread.h>
#include <netinet/in.h>
#include <time.h>

#define MAX_SOCKET_CONFIGS 16
#define MAX_TCP_CONNECTIONS 16

// Socket working modes
typedef enum {
    SOCKET_MODE_UDP_CLIENT = 0,
    SOCKET_MODE_TCP_CLIENT,
    SOCKET_MODE_UDP_SERVER,
    SOCKET_MODE_TCP_SERVER,
    SOCKET_MODE_HTTP,
} socket_working_mode_t;

// Socket modes
typedef enum {
    SOCKET_MODE_NONE = 0,
    SOCKET_MODE_MULTICAST,
    SOCKET_MODE_MODBUS_TCP,
    SOCKET_MODE_SHORT_CONNECTION,
    SOCKET_MODE_BOTH_SUPPORT,
} socket_mode_t;

// Heartbeat types
typedef enum {
    HEARTBEAT_TYPE_NONE = 0,
    HEARTBEAT_TYPE_CUSTOM,
    HEARTBEAT_TYPE_IMEI,
    HEARTBEAT_TYPE_SN,
    HEARTBEAT_TYPE_ICCID,
    HEARTBEAT_TYPE_MAC,
} heartbeat_type_t;

// Packet types
typedef enum {
    PACKET_TYPE_ASCII = 0,
    PACKET_TYPE_HEX
} packet_type_t;

typedef enum {
    REGISTRATION_PACKET_ONCE_CONNECTING = 0,
    REGISTRATION_PACKET_PREFIX_DATA,
    REGISTRATION_PACKET_BOTH_SUPPORT,
} registration_packet_location_t;

// HTTP methods
typedef enum {
    HTTP_METHOD_GET = 0,
    HTTP_METHOD_POST,
} http_method_t;

// SSL protocols
typedef enum {
    SSL_PROTOCOL_NONE = 0,
    SSL_PROTOCOL_TLS1_0,
    SSL_PROTOCOL_TLS1_2
} ssl_protocol_t;

// SSL verify options
typedef enum {
    SSL_VERIFY_NONE = 0,
    SSL_VERIFY_SERVER,
    SSL_VERIFY_ALL
} ssl_verify_option_t;

// Exceed modes
typedef enum {
    EXCEED_MODE_KICK = 0,
    EXCEED_MODE_KEEP
} exceed_mode_t;

// Socket connection states
typedef enum {
    SOCKET_STATE_DISCONNECTED = 0,
    SOCKET_STATE_CONNECTING,
    SOCKET_STATE_CONNECTED,
    SOCKET_STATE_ERROR
} socket_connection_state_t;

// TCP client connection structure
typedef struct {
    int client_fd;                  // Client socket file descriptor (-1 if slot is free)
    struct sockaddr_in client_addr; // Client address information
    time_t connect_time;           // When the client connected
    time_t last_activity;          // Last activity timestamp
    uint64_t bytes_sent;           // Bytes sent to this client
    uint64_t bytes_received;       // Bytes received from this client
    uint16_t transaction_id;       // Last Modbus TCP transaction ID
    bool waiting_response;         // Whether waiting for a response
    time_t request_time;          // When the last request was sent
} tcp_client_t;

// TCP client list structure
typedef struct {
    tcp_client_t clients[MAX_TCP_CONNECTIONS];  // Array of client connections
    int count;                                  // Number of active connections
    pthread_mutex_t mutex;                      // Mutex for thread-safe access
} tcp_client_list_t;

// Socket configuration
typedef struct {
    bool enabled; // Enable/disable the socket
    socket_working_mode_t working_mode; // Working mode of the socket
    char remote_server_addr[64]; // Remote server address
    uint16_t local_port; // Local port number
    uint16_t remote_port; // Remote port number
    bool udp_check_port; // UDP check port
    socket_mode_t sock_mode; // Socket mode
    uint8_t max_sockets; // Maximum number of sockets
    heartbeat_type_t heartbeat_type; // Heartbeat type
    packet_type_t heartbeat_packet_type; // Heartbeat packet type
    char heartbeat_packet[100]; // Heartbeat packet
    uint8_t registration_type; // Registration type
    packet_type_t registration_packet_type; // Registration packet type
    char registration_packet[100]; // Registration packet
    registration_packet_location_t registration_packet_location; // Registration packet location
    http_method_t http_method; // HTTP method
    ssl_protocol_t ssl_protocol; // SSL protocol
    ssl_verify_option_t ssl_verify_option; // SSL verify option
    char server_ca[128]; // Server CA
    char client_certificate[128]; // Client certificate
    char client_key[128]; // Client key
    char http_url[101]; // HTTP URL
    char http_header[181]; // HTTP header
    bool remove_header; // Remove header
    bool modbus_poll; // Modbus poll
    bool modbus_tcp_exception; // Modbus TCP exception
    uint16_t short_connection_duration; // Short connection duration
    uint16_t reconnection_period; // Reconnection period
    uint16_t response_timeout; // Response timeout
    exceed_mode_t exceed_mode; // Exceed mode
    uint16_t heartbeat_interval; // Heartbeat interval

    // New tracking fields
    socket_connection_state_t connection_state; // Current connection state
    uint64_t total_bytes_sent;     // Total bytes sent through this socket
    uint64_t total_bytes_received; // Total bytes received through this socket
    time_t last_connection_time;   // Timestamp of last successful connection
    time_t last_activity_time;     // Timestamp of last send/receive activity

    // Socket access fields
    int sock_fd;                   // Socket file descriptor (-1 if not open)
    pthread_mutex_t sock_mutex;    // Mutex to protect socket access

    // TCP client management
    tcp_client_list_t* clients;    // List of TCP client connections
} socket_config_t;

// Initialize socket configuration
void socket_init(void);

// Get socket configuration
socket_config_t* socket_get_config(int port_index);

// Parse socket configuration from JSON string
bool socket_parse_config(const char *json_str, socket_config_t *config);

// Thread-safe socket operations
ssize_t socket_send(socket_config_t *config, const void *buf, size_t len, int flags);
ssize_t socket_sendto(socket_config_t *config, const void *buf, size_t len, int flags,
                     const struct sockaddr *dest_addr, socklen_t addrlen);
ssize_t socket_recv(socket_config_t *config, void *buf, size_t len, int flags);
ssize_t socket_recvfrom(socket_config_t *config, void *buf, size_t len, int flags,
                       struct sockaddr *src_addr, socklen_t *addrlen);

// TCP client management functions
tcp_client_t* socket_get_client(socket_config_t *config, int client_index);
int socket_add_client(socket_config_t *config, int client_fd, struct sockaddr_in *client_addr);
void socket_remove_client(socket_config_t *config, int client_index);
ssize_t socket_send_to_client(socket_config_t *config, int client_index, const void *buf, size_t len);
ssize_t socket_broadcast_to_clients(socket_config_t *config, const void *buf, size_t len);

#endif // SOCKET_H
