#include "pthread.h"
#include "serial.h"
#include "socket.h"
#include "debug.h"
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>
#include <ctype.h>
#include <fcntl.h>
#include <time.h>

#define MAX_BUFFER_SIZE 1024
#define MAX_TCP_CONNECTIONS 16
#define MODBUS_TCP_HEADER_SIZE 6
#define MODBUS_RTU_MAX_SIZE 256

// Initialize TCP connection list
static void tcp_connection_list_init(tcp_connection_list_t* list) {
    memset(list, 0, sizeof(tcp_connection_list_t));
    pthread_mutex_init(&list->mutex, NULL);
}

// Clean up TCP connection list
static void tcp_connection_list_cleanup(tcp_connection_list_t* list) {
    pthread_mutex_lock(&list->mutex);
    for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
        if (list->connections[i].client_fd > 0) {
            close(list->connections[i].client_fd);
            list->connections[i].client_fd = -1;
        }
    }
    list->count = 0;
    pthread_mutex_unlock(&list->mutex);
    pthread_mutex_destroy(&list->mutex);
}

// Add new connection to list
static int tcp_connection_list_add(tcp_connection_list_t* list, int client_fd, 
                                 struct sockaddr_in* client_addr, socket_config_t* config) {
    int result = -1;
    pthread_mutex_lock(&list->mutex);
    
    // Check if we've reached the maximum connections
    if (list->count >= config->max_sockets) {
        if (config->exceed_mode == EXCEED_MODE_KEEP) {
            // Reject new connection
            pthread_mutex_unlock(&list->mutex);
            return -1;
        } else { // EXCEED_MODE_KICK
            // Find oldest connection
            time_t oldest_time = time(NULL);
            int oldest_idx = -1;
            for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
                if (list->connections[i].client_fd > 0 && 
                    list->connections[i].connect_time < oldest_time) {
                    oldest_time = list->connections[i].connect_time;
                    oldest_idx = i;
                }
            }
            if (oldest_idx >= 0) {
                // Close oldest connection
                close(list->connections[oldest_idx].client_fd);
                list->count--;
                // Use this slot for new connection
                result = oldest_idx;
            }
        }
    } else {
        // Find empty slot
        for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
            if (list->connections[i].client_fd <= 0) {
                result = i;
                break;
            }
        }
    }
    
    if (result >= 0) {
        // Initialize new connection
        list->connections[result].client_fd = client_fd;
        list->connections[result].client_addr = *client_addr;
        list->connections[result].connect_time = time(NULL);
        list->connections[result].last_activity = list->connections[result].connect_time;
        list->connections[result].bytes_sent = 0;
        list->connections[result].bytes_received = 0;
        list->connections[result].transaction_id = 0;
        list->connections[result].waiting_response = false;
        list->count++;
    }
    
    pthread_mutex_unlock(&list->mutex);
    return result;
}

// Remove connection from list
static void tcp_connection_list_remove(tcp_connection_list_t* list, int index) {
    pthread_mutex_lock(&list->mutex);
    if (index >= 0 && index < MAX_TCP_CONNECTIONS) {
        if (list->connections[index].client_fd > 0) {
            close(list->connections[index].client_fd);
            list->connections[index].client_fd = -1;
            list->count--;
        }
    }
    pthread_mutex_unlock(&list->mutex);
}

// Convert Modbus TCP frame to RTU frame
static int modbus_tcp_to_rtu(const uint8_t* tcp_frame, int tcp_len, uint8_t* rtu_frame) {
    if (tcp_len < MODBUS_TCP_HEADER_SIZE || tcp_len > MODBUS_RTU_MAX_SIZE + MODBUS_TCP_HEADER_SIZE) {
        return -1;
    }
    
    // Extract Modbus TCP header
    uint16_t transaction_id = (tcp_frame[0] << 8) | tcp_frame[1];
    uint16_t protocol_id = (tcp_frame[2] << 8) | tcp_frame[3];
    uint16_t length = (tcp_frame[4] << 8) | tcp_frame[5];
    
    // Verify protocol ID and length
    if (protocol_id != 0 || length != tcp_len - 6) {
        return -1;
    }
    
    // Copy function code and data
    int rtu_len = tcp_len - 6;
    memcpy(rtu_frame, tcp_frame + 6, rtu_len);
    
    return rtu_len;
}

// Convert Modbus RTU frame to TCP frame
static int modbus_rtu_to_tcp(const uint8_t* rtu_frame, int rtu_len, uint8_t* tcp_frame, 
                            uint16_t transaction_id, bool exception) {
    if (rtu_len < 1 || rtu_len > MODBUS_RTU_MAX_SIZE) {
        return -1;
    }
    
    // Build Modbus TCP header
    tcp_frame[0] = transaction_id >> 8;
    tcp_frame[1] = transaction_id & 0xFF;
    tcp_frame[2] = 0; // Protocol ID high byte
    tcp_frame[3] = 0; // Protocol ID low byte
    tcp_frame[4] = (rtu_len >> 8) & 0xFF;
    tcp_frame[5] = rtu_len & 0xFF;
    
    // Copy RTU frame
    memcpy(tcp_frame + 6, rtu_frame, rtu_len);
    
    // If this is an exception response and modbus_tcp_exception is enabled,
    // set the MSB of the function code
    if (exception && (rtu_frame[0] & 0x80)) {
        tcp_frame[7] = rtu_frame[1] | 0x80;
    }
    
    return rtu_len + 6;
}

// Thread-safe socket operations implementation
ssize_t socket_send(socket_config_t *config, const void *buf, size_t len, int flags) {
    ssize_t result;
    pthread_mutex_lock(&config->sock_mutex);
    if (config->sock_fd >= 0) {
        result = send(config->sock_fd, buf, len, flags);
        if (result > 0) {
            config->total_bytes_sent += result;
            config->last_activity_time = time(NULL);
        }
    } else {
        result = -1;
        errno = EBADF;
    }
    pthread_mutex_unlock(&config->sock_mutex);
    return result;
}

ssize_t socket_sendto(socket_config_t *config, const void *buf, size_t len, int flags,
                     const struct sockaddr *dest_addr, socklen_t addrlen) {
    ssize_t result;
    pthread_mutex_lock(&config->sock_mutex);
    if (config->sock_fd >= 0) {
        result = sendto(config->sock_fd, buf, len, flags, dest_addr, addrlen);
        if (result > 0) {
            config->total_bytes_sent += result;
            config->last_activity_time = time(NULL);
        }
    } else {
        result = -1;
        errno = EBADF;
    }
    pthread_mutex_unlock(&config->sock_mutex);
    return result;
}

ssize_t socket_recv(socket_config_t *config, void *buf, size_t len, int flags) {
    ssize_t result;
    pthread_mutex_lock(&config->sock_mutex);
    if (config->sock_fd >= 0) {
        result = recv(config->sock_fd, buf, len, flags);
        if (result > 0) {
            config->total_bytes_received += result;
            config->last_activity_time = time(NULL);
        }
    } else {
        result = -1;
        errno = EBADF;
    }
    pthread_mutex_unlock(&config->sock_mutex);
    return result;
}

ssize_t socket_recvfrom(socket_config_t *config, void *buf, size_t len, int flags,
                       struct sockaddr *src_addr, socklen_t *addrlen) {
    ssize_t result;
    pthread_mutex_lock(&config->sock_mutex);
    if (config->sock_fd >= 0) {
        result = recvfrom(config->sock_fd, buf, len, flags, src_addr, addrlen);
        if (result > 0) {
            config->total_bytes_received += result;
            config->last_activity_time = time(NULL);
        }
    } else {
        result = -1;
        errno = EBADF;
    }
    pthread_mutex_unlock(&config->sock_mutex);
    return result;
}

// Convert hex char to integer
static int hex_to_int(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

// Convert hex string to byte array
// Returns number of bytes converted, or -1 on error
static int hex_string_to_bytes(const char* hex_str, uint8_t* bytes, int max_len) {
    int hex_len = strlen(hex_str);
    int byte_len = 0;
    
    // Check if string length is even
    if (hex_len % 2 != 0) {
        DBG_ERROR("Invalid hex string length");
        return -1;
    }
    
    // Check if output buffer is large enough
    if (hex_len / 2 > max_len) {
        DBG_ERROR("Output buffer too small for hex string");
        return -1;
    }
    
    // Convert each pair of hex chars to a byte
    for (int i = 0; i < hex_len; i += 2) {
        int high = hex_to_int(hex_str[i]);
        int low = hex_to_int(hex_str[i + 1]);
        
        if (high == -1 || low == -1) {
            DBG_ERROR("Invalid hex characters in string");
            return -1;
        }
        
        bytes[byte_len++] = (high << 4) | low;
    }
    
    return byte_len;
}

// TCP client management functions implementation
tcp_connection_t* socket_get_client(socket_config_t *config, int client_index) {
    if (!config || !config->clients || client_index < 0 || client_index >= MAX_TCP_CONNECTIONS) {
        return NULL;
    }
    
    tcp_connection_t* client = NULL;
    pthread_mutex_lock(&config->clients->mutex);
    if (config->clients->connections[client_index].client_fd > 0) {
        client = &config->clients->connections[client_index];
    }
    pthread_mutex_unlock(&config->clients->mutex);
    return client;
}

int socket_add_client(socket_config_t *config, int client_fd, struct sockaddr_in *client_addr) {
    if (!config || !config->clients || client_fd < 0) {
        return -1;
    }
    
    int result = -1;
    pthread_mutex_lock(&config->clients->mutex);
    
    // Check if we've reached the maximum connections
    if (config->clients->count >= config->max_sockets) {
        if (config->exceed_mode == EXCEED_MODE_KEEP) {
            // Reject new connection
            pthread_mutex_unlock(&config->clients->mutex);
            return -1;
        } else { // EXCEED_MODE_KICK
            // Find oldest connection
            time_t oldest_time = time(NULL);
            int oldest_idx = -1;
            for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
                if (config->clients->connections[i].client_fd > 0 && 
                    config->clients->connections[i].connect_time < oldest_time) {
                    oldest_time = config->clients->connections[i].connect_time;
                    oldest_idx = i;
                }
            }
            if (oldest_idx >= 0) {
                // Close oldest connection
                close(config->clients->connections[oldest_idx].client_fd);
                config->clients->connections[oldest_idx].client_fd = -1;
                config->clients->count--;
                result = oldest_idx;
            }
        }
    } else {
        // Find empty slot
        for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
            if (config->clients->connections[i].client_fd <= 0) {
                result = i;
                break;
            }
        }
    }
    
    if (result >= 0) {
        // Initialize new connection
        tcp_connection_t* client = &config->clients->connections[result];
        client->client_fd = client_fd;
        client->client_addr = *client_addr;
        client->connect_time = time(NULL);
        client->last_activity = client->connect_time;
        client->bytes_sent = 0;
        client->bytes_received = 0;
        client->transaction_id = 0;
        client->waiting_response = false;
        config->clients->count++;
    }
    
    pthread_mutex_unlock(&config->clients->mutex);
    return result;
}

void socket_remove_client(socket_config_t *config, int client_index) {
    if (!config || !config->clients || client_index < 0 || client_index >= MAX_TCP_CONNECTIONS) {
        return;
    }
    
    pthread_mutex_lock(&config->clients->mutex);
    if (config->clients->connections[client_index].client_fd > 0) {
        close(config->clients->connections[client_index].client_fd);
        config->clients->connections[client_index].client_fd = -1;
        config->clients->count--;
    }
    pthread_mutex_unlock(&config->clients->mutex);
}

ssize_t socket_send_to_client(socket_config_t *config, int client_index, const void *buf, size_t len) {
    if (!config || !config->clients || client_index < 0 || client_index >= MAX_TCP_CONNECTIONS) {
        return -1;
    }
    
    ssize_t result = -1;
    pthread_mutex_lock(&config->clients->mutex);
    tcp_connection_t* client = &config->clients->connections[client_index];
    if (client->client_fd > 0) {
        result = send(client->client_fd, buf, len, 0);
        if (result > 0) {
            client->bytes_sent += result;
            client->last_activity = time(NULL);
            config->total_bytes_sent += result;
            config->last_activity_time = time(NULL);
        }
    }
    pthread_mutex_unlock(&config->clients->mutex);
    return result;
}

ssize_t socket_broadcast_to_clients(socket_config_t *config, const void *buf, size_t len) {
    if (!config || !config->clients) {
        return -1;
    }
    
    ssize_t total_sent = 0;
    pthread_mutex_lock(&config->clients->mutex);
    for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
        tcp_connection_t* client = &config->clients->connections[i];
        if (client->client_fd > 0) {
            ssize_t sent = send(client->client_fd, buf, len, 0);
            if (sent > 0) {
                client->bytes_sent += sent;
                client->last_activity = time(NULL);
                total_sent += sent;
            }
        }
    }
    if (total_sent > 0) {
        config->total_bytes_sent += total_sent;
        config->last_activity_time = time(NULL);
    }
    pthread_mutex_unlock(&config->clients->mutex);
    return total_sent;
}

static void* udp_client_thread(void* arg)
{
    int port_index = (int)arg;
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index: %d", port_index);
        return NULL;
    }

    serial_config_t* serial_config = serial_get_config(port_index);
    socket_config_t* socket_config = socket_get_config(port_index);
    
    if (!serial_config || !socket_config) {
        DBG_ERROR("Failed to get configurations");
        return NULL;
    }

    // Initialize connection state and statistics
    socket_config->connection_state = SOCKET_STATE_DISCONNECTED;
    socket_config->total_bytes_sent = 0;
    socket_config->total_bytes_received = 0;
    socket_config->last_connection_time = 0;
    socket_config->last_activity_time = 0;
    socket_config->sock_fd = -1;

    // Initialize socket mutex
    if (pthread_mutex_init(&socket_config->sock_mutex, NULL) != 0) {
        DBG_ERROR("Failed to initialize socket mutex");
        return NULL;
    }

    // Create UDP socket
    int sock_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock_fd < 0) {
        DBG_ERROR("Failed to create UDP socket: %s", strerror(errno));
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Store socket fd in config
    pthread_mutex_lock(&socket_config->sock_mutex);
    socket_config->sock_fd = sock_fd;
    pthread_mutex_unlock(&socket_config->sock_mutex);

    // Set up local address
    struct sockaddr_in local_addr;
    memset(&local_addr, 0, sizeof(local_addr));
    local_addr.sin_family = AF_INET;
    local_addr.sin_addr.s_addr = INADDR_ANY;
    local_addr.sin_port = htons(socket_config->local_port);

    // Bind socket to local address
    if (bind(sock_fd, (struct sockaddr*)&local_addr, sizeof(local_addr)) < 0) {
        DBG_ERROR("Failed to bind UDP socket: %s", strerror(errno));
        close(sock_fd);
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_lock(&socket_config->sock_mutex);
        socket_config->sock_fd = -1;
        pthread_mutex_unlock(&socket_config->sock_mutex);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Set up remote address
    struct sockaddr_in remote_addr;
    memset(&remote_addr, 0, sizeof(remote_addr));
    remote_addr.sin_family = AF_INET;
    remote_addr.sin_port = htons(socket_config->remote_port);
    
    // Convert IP address
    if (inet_pton(AF_INET, socket_config->remote_server_addr, &remote_addr.sin_addr) <= 0) {
        DBG_ERROR("Invalid remote server address");
        close(sock_fd);
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_lock(&socket_config->sock_mutex);
        socket_config->sock_fd = -1;
        pthread_mutex_unlock(&socket_config->sock_mutex);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Set up multicast if needed
    if (socket_config->sock_mode == SOCKET_MODE_MULTICAST) {
        struct ip_mreq mreq;
        mreq.imr_multiaddr.s_addr = remote_addr.sin_addr.s_addr;
        mreq.imr_interface.s_addr = INADDR_ANY;
        
        if (setsockopt(sock_fd, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq)) < 0) {
            DBG_ERROR("Failed to join multicast group: %s", strerror(errno));
            close(sock_fd);
            socket_config->connection_state = SOCKET_STATE_ERROR;
            pthread_mutex_lock(&socket_config->sock_mutex);
            socket_config->sock_fd = -1;
            pthread_mutex_unlock(&socket_config->sock_mutex);
            pthread_mutex_destroy(&socket_config->sock_mutex);
            return NULL;
        }
    }

    // Open serial port
    int serial_fd = serial_open(0);
    if (serial_fd < 0) {
        DBG_ERROR("Failed to open serial port");
        close(sock_fd);
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_lock(&socket_config->sock_mutex);
        socket_config->sock_fd = -1;
        pthread_mutex_unlock(&socket_config->sock_mutex);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Update connection state and time
    socket_config->connection_state = SOCKET_STATE_CONNECTED;
    socket_config->last_connection_time = time(NULL);
    socket_config->last_activity_time = socket_config->last_connection_time;

    // Initialize heartbeat and registration packet handling
    bool registration_sent = false;
    time_t last_heartbeat_time = 0;
    uint8_t heartbeat_bytes[MAX_BUFFER_SIZE];
    int heartbeat_len = 0;

    // If heartbeat is custom and hex type, convert it once
    if (socket_config->heartbeat_type == HEARTBEAT_TYPE_CUSTOM && 
        socket_config->heartbeat_packet_type == PACKET_TYPE_HEX) {
        heartbeat_len = hex_string_to_bytes(socket_config->heartbeat_packet, 
                                          heartbeat_bytes, sizeof(heartbeat_bytes));
        if (heartbeat_len < 0) {
            DBG_ERROR("Failed to convert heartbeat hex string");
            serial_close(0);
            close(sock_fd);
            pthread_mutex_lock(&socket_config->sock_mutex);
            socket_config->sock_fd = -1;
            pthread_mutex_unlock(&socket_config->sock_mutex);
            pthread_mutex_destroy(&socket_config->sock_mutex);
            return NULL;
        }
        DBG_INFO("Heartbeat hex packet converted, length: %d bytes", heartbeat_len);
    }

    // Main loop
    while (1) {
        time_t current_time = time(NULL);

        // Handle registration packet based on location type
        if (socket_config->registration_type > 0) {
            switch (socket_config->registration_packet_location) {
                case REGISTRATION_PACKET_ONCE_CONNECTING:
                case REGISTRATION_PACKET_BOTH_SUPPORT:
                    if (!registration_sent) {
                        ssize_t sent_len = socket_sendto(socket_config, socket_config->registration_packet, 
                                                        strlen(socket_config->registration_packet), 0,
                                                        (struct sockaddr*)&remote_addr, sizeof(remote_addr));
                        if (sent_len > 0) {
                            registration_sent = true;
                            socket_config->last_activity_time = current_time;
                            DBG_INFO("Registration packet sent successfully (once connecting)");
                        }
                    }
                    break;
                default:
                    break;
            }
        }

        // Handle heartbeat
        if (socket_config->heartbeat_type > HEARTBEAT_TYPE_NONE && 
            current_time - last_heartbeat_time >= socket_config->heartbeat_interval) {
            
            ssize_t sent_len = 0;
            if (socket_config->heartbeat_type == HEARTBEAT_TYPE_CUSTOM) {
                if (socket_config->heartbeat_packet_type == PACKET_TYPE_HEX) {
                    // Send pre-converted hex packet
                    if (heartbeat_len > 0) {
                        sent_len = socket_sendto(socket_config, heartbeat_bytes, heartbeat_len, 0,
                                                (struct sockaddr*)&remote_addr, sizeof(remote_addr));
                        if (sent_len > 0) {
                            DBG_DEBUG("Heartbeat hex packet sent");
                        }
                    }
                } else {
                    // Send ASCII packet
                    sent_len = socket_sendto(socket_config, socket_config->heartbeat_packet, 
                                            strlen(socket_config->heartbeat_packet), 0,
                                            (struct sockaddr*)&remote_addr, sizeof(remote_addr));
                    if (sent_len > 0) {
                        DBG_DEBUG("Heartbeat ASCII packet sent");
                    }
                }
            } else {
                // Other heartbeat types (IMEI, SN, ICCID, MAC)
                sent_len = socket_sendto(socket_config, socket_config->heartbeat_packet, 
                                        strlen(socket_config->heartbeat_packet), 0,
                                        (struct sockaddr*)&remote_addr, sizeof(remote_addr));
                if (sent_len > 0) {
                    DBG_DEBUG("Heartbeat packet sent");
                }
            }
            
            if (sent_len > 0) {
                socket_config->last_activity_time = current_time;
                last_heartbeat_time = current_time;
            }
        }

        // Set up select for both socket and serial
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(sock_fd, &read_fds);
        FD_SET(serial_fd, &read_fds);
        
        // Find the highest file descriptor
        int max_fd = (sock_fd > serial_fd) ? sock_fd : serial_fd;
        
        // Set timeout for select
        struct timeval timeout = {0, 100000}; // 100ms timeout
        
        // Wait for activity on either file descriptor
        int activity = select(max_fd + 1, &read_fds, NULL, NULL, &timeout);
        
        if (activity < 0) {
            DBG_ERROR("Select error: %s", strerror(errno));
            continue;
        }
        
        if (activity == 0) {
            // Timeout occurred, continue to next iteration
            continue;
        }

        // Check for socket activity
        if (FD_ISSET(sock_fd, &read_fds)) {
            char buffer[MAX_BUFFER_SIZE];
            struct sockaddr_in sender_addr;
            socklen_t sender_len = sizeof(sender_addr);
            
            ssize_t recv_len = socket_recvfrom(socket_config, buffer, sizeof(buffer), 0,
                                              (struct sockaddr*)&sender_addr, &sender_len);
            if (recv_len > 0) {
                // Check if UDP port checking is enabled
                if (socket_config->udp_check_port) {
                    // Only accept data from configured remote port
                    if (ntohs(sender_addr.sin_port) != socket_config->remote_port) {
                        DBG_WARN("Received data from unauthorized port %d, expected %d", 
                                ntohs(sender_addr.sin_port), socket_config->remote_port);
                        continue;
                    }
                    
                    // If remote address is specified, also check IP
                    if (strcmp(socket_config->remote_server_addr, "0.0.0.0") != 0) {
                        char sender_ip[INET_ADDRSTRLEN];
                        inet_ntop(AF_INET, &(sender_addr.sin_addr), sender_ip, INET_ADDRSTRLEN);
                        if (strcmp(sender_ip, socket_config->remote_server_addr) != 0) {
                            DBG_WARN("Received data from unauthorized IP %s, expected %s",
                                    sender_ip, socket_config->remote_server_addr);
                            continue;
                        }
                    }
                }

                // Forward received data to serial port
                serial_write(0, buffer, recv_len);
            }
        }

        // Check for serial activity
        if (FD_ISSET(serial_fd, &read_fds)) {
            char serial_buffer[MAX_BUFFER_SIZE];
            ssize_t serial_len = serial_read(0, serial_buffer, sizeof(serial_buffer));
            if (serial_len > 0) {
                // Handle registration packet as prefix if configured
                if (socket_config->registration_packet_location > 0) {
                    ssize_t sent_len = socket_sendto(socket_config, socket_config->registration_packet, 
                                                    strlen(socket_config->registration_packet), 0,
                                                    (struct sockaddr*)&remote_addr, sizeof(remote_addr));
                    if (sent_len > 0) {
                        socket_config->last_activity_time = time(NULL);
                        DBG_DEBUG("Registration packet sent as prefix");
                    }
                }

                // Forward received data to socket
                ssize_t sent_len = socket_sendto(socket_config, serial_buffer, serial_len, 0,
                                                (struct sockaddr*)&remote_addr, sizeof(remote_addr));
                if (sent_len > 0) {
                    socket_config->last_activity_time = time(NULL);
                }
            }
        }
    }

    // Cleanup
    pthread_mutex_lock(&socket_config->sock_mutex);
    socket_config->connection_state = SOCKET_STATE_DISCONNECTED;
    close(socket_config->sock_fd);
    socket_config->sock_fd = -1;
    pthread_mutex_unlock(&socket_config->sock_mutex);
    pthread_mutex_destroy(&socket_config->sock_mutex);
    serial_close(0);
    return NULL;
}

static void* tcp_client_thread(void* arg)
{
    int port_index = (int)arg;
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index: %d", port_index);
        return NULL;
    }

    serial_config_t* serial_config = serial_get_config(port_index);
    socket_config_t* socket_config = socket_get_config(port_index);
    while (1) {

    }
}

static void* udp_server_thread(void* arg)
{
    int port_index = (int)arg;
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index: %d", port_index);
        return NULL;
    }

    serial_config_t* serial_config = serial_get_config(port_index);
    socket_config_t* socket_config = socket_get_config(port_index);
    
    if (!serial_config || !socket_config) {
        DBG_ERROR("Failed to get configurations");
        return NULL;
    }

    // Create UDP socket
    int sock_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock_fd < 0) {
        DBG_ERROR("Failed to create UDP socket: %s", strerror(errno));
        return NULL;
    }

    // Set up server address
    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(socket_config->local_port);

    // Bind socket to server address
    if (bind(sock_fd, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        DBG_ERROR("Failed to bind UDP socket: %s", strerror(errno));
        close(sock_fd);
        return NULL;
    }

    // Open serial port
    int serial_fd = serial_open(0);
    if (serial_fd < 0) {
        DBG_ERROR("Failed to open serial port");
        close(sock_fd);
        return NULL;
    }

    // Store last client address for response
    struct sockaddr_in last_client_addr;
    socklen_t last_client_len = sizeof(last_client_addr);
    bool has_client = false;

    // Initialize heartbeat handling
    time_t last_heartbeat_time = 0;
    uint8_t heartbeat_bytes[MAX_BUFFER_SIZE];
    int heartbeat_len = 0;

    // If heartbeat is custom and hex type, convert it once
    if (socket_config->heartbeat_type == HEARTBEAT_TYPE_CUSTOM && 
        socket_config->heartbeat_packet_type == PACKET_TYPE_HEX) {
        heartbeat_len = hex_string_to_bytes(socket_config->heartbeat_packet, 
                                          heartbeat_bytes, sizeof(heartbeat_bytes));
        if (heartbeat_len < 0) {
            DBG_ERROR("Failed to convert heartbeat hex string");
            serial_close(0);
            close(sock_fd);
            return NULL;
        }
        DBG_INFO("Heartbeat hex packet converted, length: %d bytes", heartbeat_len);
    }

    DBG_INFO("UDP server started on port %d", socket_config->local_port);

    // Main loop
    while (1) {
        time_t current_time = time(NULL);

        // Handle heartbeat if we have a client
        if (has_client && socket_config->heartbeat_type > HEARTBEAT_TYPE_NONE && 
            current_time - last_heartbeat_time >= socket_config->heartbeat_interval) {
            
            if (socket_config->heartbeat_type == HEARTBEAT_TYPE_CUSTOM) {
                if (socket_config->heartbeat_packet_type == PACKET_TYPE_HEX) {
                    // Send pre-converted hex packet
                    if (heartbeat_len > 0) {
                        if (sendto(sock_fd, heartbeat_bytes, heartbeat_len, 0,
                                 (struct sockaddr*)&last_client_addr, last_client_len) > 0) {
                            DBG_DEBUG("Heartbeat hex packet sent to client");
                        }
                    }
                } else {
                    // Send ASCII packet
                    if (sendto(sock_fd, socket_config->heartbeat_packet, 
                             strlen(socket_config->heartbeat_packet), 0,
                             (struct sockaddr*)&last_client_addr, last_client_len) > 0) {
                        DBG_DEBUG("Heartbeat ASCII packet sent to client");
                    }
                }
            } else {
                // Other heartbeat types (IMEI, SN, ICCID, MAC)
                if (sendto(sock_fd, socket_config->heartbeat_packet, 
                         strlen(socket_config->heartbeat_packet), 0,
                         (struct sockaddr*)&last_client_addr, last_client_len) > 0) {
                    DBG_DEBUG("Heartbeat packet sent to client");
                }
            }
            last_heartbeat_time = current_time;
        }

        // Set up select for both socket and serial
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(sock_fd, &read_fds);
        FD_SET(serial_fd, &read_fds);
        
        // Find the highest file descriptor
        int max_fd = (sock_fd > serial_fd) ? sock_fd : serial_fd;
        
        // Set timeout for select
        struct timeval timeout = {0, 100000}; // 100ms timeout
        
        // Wait for activity on either file descriptor
        int activity = select(max_fd + 1, &read_fds, NULL, NULL, &timeout);
        
        if (activity < 0) {
            DBG_ERROR("Select error: %s", strerror(errno));
            continue;
        }
        
        if (activity == 0) {
            // Timeout occurred, continue to next iteration
            continue;
        }

        // Check for socket activity
        if (FD_ISSET(sock_fd, &read_fds)) {
            char buffer[MAX_BUFFER_SIZE];
            struct sockaddr_in client_addr;
            socklen_t client_len = sizeof(client_addr);
            
            ssize_t recv_len = recvfrom(sock_fd, buffer, sizeof(buffer), 0,
                                      (struct sockaddr*)&client_addr, &client_len);
            if (recv_len > 0) {
                // Update last client information
                if (!has_client || 
                    client_addr.sin_addr.s_addr != last_client_addr.sin_addr.s_addr ||
                    client_addr.sin_port != last_client_addr.sin_port) {
                    memcpy(&last_client_addr, &client_addr, client_len);
                    last_client_len = client_len;
                    has_client = true;

                    // Log client information
                    char client_ip[INET_ADDRSTRLEN];
                    inet_ntop(AF_INET, &(client_addr.sin_addr), client_ip, INET_ADDRSTRLEN);
                    DBG_INFO("Data received from client %s:%d", 
                            client_ip, ntohs(client_addr.sin_port));
                }

                // Forward received data to serial port
                serial_write(0, buffer, recv_len);
            }
        }

        // Check for serial activity
        if (FD_ISSET(serial_fd, &read_fds)) {
            char serial_buffer[MAX_BUFFER_SIZE];
            ssize_t serial_len = serial_read(0, serial_buffer, sizeof(serial_buffer));
            if (serial_len > 0 && has_client) {
                // Forward received data to last client
                sendto(sock_fd, serial_buffer, serial_len, 0,
                      (struct sockaddr*)&last_client_addr, last_client_len);
            }
        }
    }

    // Cleanup
    serial_close(0);
    close(sock_fd);
    return NULL;
}

static void* tcp_server_thread(void* arg)
{
    int port_index = (int)arg;
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index: %d", port_index);
        return NULL;
    }

    serial_config_t* serial_config = serial_get_config(port_index);
    socket_config_t* socket_config = socket_get_config(port_index);
    
    if (!serial_config || !socket_config) {
        DBG_ERROR("Failed to get configurations");
        return NULL;
    }

    // Initialize connection state and statistics
    socket_config->connection_state = SOCKET_STATE_DISCONNECTED;
    socket_config->total_bytes_sent = 0;
    socket_config->total_bytes_received = 0;
    socket_config->last_connection_time = 0;
    socket_config->last_activity_time = 0;
    socket_config->sock_fd = -1;

    // Initialize socket mutex
    if (pthread_mutex_init(&socket_config->sock_mutex, NULL) != 0) {
        DBG_ERROR("Failed to initialize socket mutex");
        return NULL;
    }

    // Initialize client list
    socket_config->clients = (tcp_connection_list_t*)malloc(sizeof(tcp_connection_list_t));
    if (!socket_config->clients) {
        DBG_ERROR("Failed to allocate client list");
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }
    memset(socket_config->clients, 0, sizeof(tcp_connection_list_t));
    if (pthread_mutex_init(&socket_config->clients->mutex, NULL) != 0) {
        DBG_ERROR("Failed to initialize client list mutex");
        free(socket_config->clients);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Create TCP socket
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        DBG_ERROR("Failed to create TCP socket: %s", strerror(errno));
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_destroy(&socket_config->clients->mutex);
        free(socket_config->clients);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Enable address reuse
    int opt = 1;
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        DBG_ERROR("Failed to set socket options: %s", strerror(errno));
        close(server_fd);
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_destroy(&socket_config->clients->mutex);
        free(socket_config->clients);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Set up server address
    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(socket_config->local_port);

    // Bind socket
    if (bind(server_fd, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        DBG_ERROR("Failed to bind TCP socket: %s", strerror(errno));
        close(server_fd);
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_destroy(&socket_config->clients->mutex);
        free(socket_config->clients);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Listen for connections
    if (listen(server_fd, 5) < 0) {
        DBG_ERROR("Failed to listen on TCP socket: %s", strerror(errno));
        close(server_fd);
        socket_config->connection_state = SOCKET_STATE_ERROR;
        pthread_mutex_destroy(&socket_config->clients->mutex);
        free(socket_config->clients);
        pthread_mutex_destroy(&socket_config->sock_mutex);
        return NULL;
    }

    // Store server fd in config
    pthread_mutex_lock(&socket_config->sock_mutex);
    socket_config->sock_fd = server_fd;
    socket_config->connection_state = SOCKET_STATE_CONNECTED;
    socket_config->last_connection_time = time(NULL);
    socket_config->last_activity_time = socket_config->last_connection_time;
    pthread_mutex_unlock(&socket_config->sock_mutex);

    // Main loop
    while (1) {
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(server_fd, &read_fds);
        FD_SET(serial_fd, &read_fds);
        
        int max_fd = server_fd > serial_fd ? server_fd : serial_fd;
        
        // Add client sockets to fd_set
        pthread_mutex_lock(&socket_config->clients->mutex);
        for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
            tcp_connection_t* client = &socket_config->clients->connections[i];
            if (client->client_fd > 0) {
                FD_SET(client->client_fd, &read_fds);
                if (client->client_fd > max_fd) {
                    max_fd = client->client_fd;
                }
            }
        }
        pthread_mutex_unlock(&socket_config->clients->mutex);
        
        // Set timeout for select
        struct timeval timeout = {0, 100000}; // 100ms timeout
        
        int activity = select(max_fd + 1, &read_fds, NULL, NULL, &timeout);
        if (activity < 0) {
            if (errno == EINTR) continue;
            DBG_ERROR("Select error: %s", strerror(errno));
            break;
        }
        
        time_t current_time = time(NULL);

        // Check for new connections
        if (FD_ISSET(server_fd, &read_fds)) {
            struct sockaddr_in client_addr;
            socklen_t client_len = sizeof(client_addr);
            int client_fd = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);
            
            if (client_fd >= 0) {
                // Set non-blocking mode
                int flags = fcntl(client_fd, F_GETFL, 0);
                fcntl(client_fd, F_SETFL, flags | O_NONBLOCK);
                
                int idx = socket_add_client(socket_config, client_fd, &client_addr);
                if (idx >= 0) {
                    char client_ip[INET_ADDRSTRLEN];
                    inet_ntop(AF_INET, &client_addr.sin_addr, client_ip, sizeof(client_ip));
                    DBG_INFO("New client connected from %s:%d", client_ip, ntohs(client_addr.sin_port));
                } else {
                    close(client_fd);
                    DBG_WARN("Connection rejected (max connections reached)");
                }
            }
        }

        // Check for serial port data
        if (FD_ISSET(serial_fd, &read_fds)) {
            uint8_t serial_buffer[MODBUS_RTU_MAX_SIZE];
            ssize_t serial_len = serial_read(port_index, serial_buffer, sizeof(serial_buffer));
            
            if (serial_len > 0) {
                pthread_mutex_lock(&socket_config->clients->mutex);
                
                // Find connection waiting for response
                for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
                    tcp_connection_t* client = &socket_config->clients->connections[i];
                    if (client->client_fd > 0 && client->waiting_response) {
                        // Convert RTU response to TCP if needed
                        if (socket_config->sock_mode == SOCKET_MODE_MODBUS_TCP) {
                            uint8_t tcp_buffer[MODBUS_RTU_MAX_SIZE + MODBUS_TCP_HEADER_SIZE];
                            int tcp_len = modbus_rtu_to_tcp(serial_buffer, serial_len, tcp_buffer,
                                                          client->transaction_id,
                                                          socket_config->modbus_tcp_exception);
                            
                            if (tcp_len > 0) {
                                socket_send_to_client(socket_config, i, tcp_buffer, tcp_len);
                            }
                        } else {
                            socket_send_to_client(socket_config, i, serial_buffer, serial_len);
                        }
                        
                        client->waiting_response = false;
                        break;
                    }
                }
                
                pthread_mutex_unlock(&socket_config->clients->mutex);
            }
        }

        // Check client sockets
        pthread_mutex_lock(&socket_config->clients->mutex);
        for (int i = 0; i < MAX_TCP_CONNECTIONS; i++) {
            tcp_connection_t* client = &socket_config->clients->connections[i];
            if (client->client_fd > 0) {
                // Check for timeout on waiting response
                if (client->waiting_response && 
                    (current_time - client->request_time >= socket_config->response_timeout)) {
                    DBG_WARN("Response timeout for client %d", i);
                    socket_remove_client(socket_config, i);
                    continue;
                }
                
                // Check for client data
                if (FD_ISSET(client->client_fd, &read_fds)) {
                    uint8_t tcp_buffer[MODBUS_RTU_MAX_SIZE + MODBUS_TCP_HEADER_SIZE];
                    ssize_t recv_len = recv(client->client_fd, tcp_buffer, sizeof(tcp_buffer), 0);
                    
                    if (recv_len <= 0) {
                        if (recv_len == 0 || errno != EAGAIN) {
                            socket_remove_client(socket_config, i);
                        }
                        continue;
                    }
                    
                    client->bytes_received += recv_len;
                    client->last_activity = current_time;
                    socket_config->total_bytes_received += recv_len;
                    socket_config->last_activity_time = current_time;
                    
                    if (socket_config->sock_mode == SOCKET_MODE_MODBUS_TCP) {
                        // Extract transaction ID from Modbus TCP frame
                        client->transaction_id = (tcp_buffer[0] << 8) | tcp_buffer[1];
                        
                        // Convert TCP frame to RTU
                        uint8_t rtu_buffer[MODBUS_RTU_MAX_SIZE];
                        int rtu_len = modbus_tcp_to_rtu(tcp_buffer, recv_len, rtu_buffer);
                        
                        if (rtu_len > 0) {
                            ssize_t sent = serial_write(port_index, rtu_buffer, rtu_len);
                            if (sent > 0) {
                                client->waiting_response = true;
                                client->request_time = current_time;

                                if (socket_config->modbus_poll) {
                                    // Wait for response within timeout
                                    int read_len = serial_read(port_index, rtu_buffer, sizeof(rtu_buffer), 
                                                             socket_config->response_timeout, 10);
                                    if (read_len > 0) {
                                        // Convert RTU response to TCP
                                        uint8_t tcp_response[MODBUS_RTU_MAX_SIZE + MODBUS_TCP_HEADER_SIZE];
                                        int tcp_len = modbus_rtu_to_tcp(rtu_buffer, read_len, tcp_response,
                                                                      client->transaction_id,
                                                                      socket_config->modbus_tcp_exception);
                                        
                                        if (tcp_len > 0) {
                                            socket_send_to_client(socket_config, i, tcp_response, tcp_len);
                                        }
                                    }
                                    client->waiting_response = false;
                                }
                            }
                        }
                    } else {
                        // Direct forwarding mode
                        ssize_t sent = serial_write(port_index, tcp_buffer, recv_len);
                        if (sent > 0 && socket_config->modbus_poll) {
                            // Wait for response within timeout
                            int read_len = serial_read(port_index, tcp_buffer, sizeof(tcp_buffer), 
                                                     socket_config->response_timeout, 10);
                            if (read_len > 0) {
                                socket_send_to_client(socket_config, i, tcp_buffer, read_len);
                            }
                        }
                    }
                }
            }
        }
        pthread_mutex_unlock(&socket_config->clients->mutex);
    }

    // Cleanup
    pthread_mutex_lock(&socket_config->sock_mutex);
    socket_config->connection_state = SOCKET_STATE_DISCONNECTED;
    close(socket_config->sock_fd);
    socket_config->sock_fd = -1;
    pthread_mutex_unlock(&socket_config->sock_mutex);
    
    // Clean up client list
    pthread_mutex_destroy(&socket_config->clients->mutex);
    free(socket_config->clients);
    pthread_mutex_destroy(&socket_config->sock_mutex);
    
    serial_close(port_index);
    
    return NULL;
}

static void* http_client_thread(void* arg)
{
    int port_index = (int)arg;
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index: %d", port_index);
        return NULL;
    }

    socket_config_t* serial_config = serial_get_config(port_index);
    socket_config_t* socket_config = socket_get_config(port_index);
    while (1) {

    }
}