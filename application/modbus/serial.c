#include "serial.h"
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <termios.h>
#include <unistd.h>
#include <sys/select.h>
#include <sys/time.h>
#include <errno.h>
#include <time.h>
#include "cJSON.h"
#include "db.h"

#define DBG_TAG "SERIAL"
#define DBG_LVL LOG_INFO
#include "dbg.h"


// Static serial configuration array
static serial_config_t g_serial_configs[MAX_SERIAL_PORTS] = {0};

// Get current timestamp in milliseconds
static int get_current_time_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (ts.tv_sec * 1000) + (ts.tv_nsec / 1000000);
}

// Get serial configuration by index
static serial_config_t* get_serial_config(int index) {
    if (index < 0 || index >= MAX_SERIAL_PORTS) {
        return NULL;
    }
    return &g_serial_configs[index];
}

// Find available serial port slot
static int find_available_port(void) {
    for (int i = 0; i < MAX_SERIAL_PORTS; i++) {
        if (!g_serial_configs[i].is_open) {
            return i;
        }
    }
    return -1;
}

// Find serial port by name
static int find_port_by_name(const char *port_name) {
    for (int i = 0; i < MAX_SERIAL_PORTS; i++) {
        if (g_serial_configs[i].is_open && 
            strcmp(g_serial_configs[i].port, port_name) == 0) {
            return i;
        }
    }
    return -1;
}

// Find port index by file descriptor
static int find_port_by_fd(int fd) {
    for (int i = 0; i < MAX_SERIAL_PORTS; i++) {
        if (g_serial_configs[i].fd == fd) {
            return i;
        }
    }
    return -1;
}

// Allocate write buffer for a port
static bool allocate_write_buffer(serial_config_t *config) {
    if (!config || config->write_buffer) {
        return false;
    }

    config->write_buffer = (uint8_t *)malloc(config->buffer_size);
    if (!config->write_buffer) {
        DBG_ERROR("Failed to allocate write buffer");
        return false;
    }

    config->write_buffer_pos = 0;
    config->last_write_time = get_current_time_ms();
    return true;
}

// Free write buffer for a port
static void free_write_buffer(serial_config_t *config) {
    if (config && config->write_buffer) {
        free(config->write_buffer);
        config->write_buffer = NULL;
        config->write_buffer_pos = 0;
    }
}

// Flush write buffer to serial port
static int flush_write_buffer(serial_config_t *config) {
    if (!config || !config->write_buffer || config->write_buffer_pos == 0) {
        return 0;
    }

    int ret = write(config->fd, config->write_buffer, config->write_buffer_pos);
    if (ret > 0) {
        config->write_buffer_pos = 0;
        config->last_write_time = get_current_time_ms();
        tcdrain(config->fd);  // Wait for all data to be transmitted
    }
    return ret;
}

// Check if write buffer should be flushed based on conditions
static bool should_flush_buffer(serial_config_t *config) {
    if (!config || !config->write_buffer) {
        return false;
    }

    // Check buffer size condition
    if (config->write_buffer_pos >= config->buffer_size) {
        return true;
    }

    // Check timeout condition
    int current_time = get_current_time_ms();
    if (config->write_buffer_pos > 0 && 
        (current_time - config->last_write_time) >= config->timeout) {
        return true;
    }

    return false;
}

// Parse serial configuration from JSON
static bool parse_serial_config(const char *json_str, serial_config_t *config) {
    if (!json_str || !config) {
        DBG_ERROR("Invalid parameters");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse serial config JSON");
        return false;
    }

    // Parse configuration fields
    cJSON *enabled = cJSON_GetObjectItem(root, "enabled");
    if (enabled) {
        config->enabled = cJSON_IsTrue(enabled);
    }

    cJSON *port = cJSON_GetObjectItem(root, "port");
    if (port && port->valuestring) {
        strncpy(config->port, port->valuestring, sizeof(config->port) - 1);
    }

    cJSON *baud_rate = cJSON_GetObjectItem(root, "baudRate");
    if (baud_rate) {
        config->baud_rate = baud_rate->valueint;
    }

    cJSON *data_bits = cJSON_GetObjectItem(root, "dataBits");
    if (data_bits) {
        config->data_bits = data_bits->valueint;
    }

    cJSON *stop_bits = cJSON_GetObjectItem(root, "stopBits");
    if (stop_bits) {
        config->stop_bits = stop_bits->valueint;
    }

    cJSON *parity = cJSON_GetObjectItem(root, "parity");
    if (parity) {
        config->parity = parity->valueint;
    }

    cJSON *flow_control = cJSON_GetObjectItem(root, "flowControl");
    if (flow_control) {
        config->flow_control = flow_control->valueint;
    }

    cJSON *timeout = cJSON_GetObjectItem(root, "timeout");
    if (timeout) {
        config->timeout = timeout->valueint;
    }

    cJSON *buffer_size = cJSON_GetObjectItem(root, "bufferSize");
    if (buffer_size) {
        config->buffer_size = buffer_size->valueint;
    }

    cJSON_Delete(root);
    return true;
}

// Convert serial configuration to JSON string
static char* serial_config_to_json(const serial_config_t *config) {
    if (!config) {
        DBG_ERROR("Invalid configuration");
        return NULL;
    }

    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON object");
        return NULL;
    }

    cJSON_AddBoolToObject(root, "enabled", config->enabled);
    cJSON_AddStringToObject(root, "port", config->port);
    cJSON_AddNumberToObject(root, "baudRate", config->baud_rate);
    cJSON_AddNumberToObject(root, "dataBits", config->data_bits);
    cJSON_AddNumberToObject(root, "stopBits", config->stop_bits);
    cJSON_AddNumberToObject(root, "parity", config->parity);
    cJSON_AddNumberToObject(root, "flowControl", config->flow_control);
    cJSON_AddNumberToObject(root, "timeout", config->timeout);
    cJSON_AddNumberToObject(root, "bufferSize", config->buffer_size);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    return json_str;
}

// Initialize serial configuration
void serial_init(void) {
    // Initialize first port
    char config_str[1024] = {0};
    int read_len = db_read("serial1_config", config_str, sizeof(config_str));
    if (read_len > 0) {
        if (parse_serial_config(config_str, &g_serial_configs[0])) {
            DBG_INFO("Serial port 1 configuration initialized: port=%s, baud=%d", 
                     g_serial_configs[0].port, g_serial_configs[0].baud_rate);
        }
        else {
            DBG_ERROR("Failed to parse serial port 1 configuration");
        }
    }

    // Initialize second port
    read_len = db_read("serial2_config", config_str, sizeof(config_str));
    if (read_len > 0) {
        if (parse_serial_config(config_str, &g_serial_configs[1])) {
            DBG_INFO("Serial port 2 configuration initialized: port=%s, baud=%d", 
                     g_serial_configs[1].port, g_serial_configs[1].baud_rate);
        }
        else {
            DBG_ERROR("Failed to parse serial port 2 configuration");
        }
    }
}

// Get serial configuration for a specific port
serial_config_t* serial_get_config(int port_index) {
    return get_serial_config(port_index);
}

// Open serial port
int serial_open(int port_index) {
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index");
        return -1;
    }

    serial_config_t *config = &g_serial_configs[port_index];
    if (config->is_open) {
        DBG_WARN("Port %s is already open", config->port);
        return port_index;
    }

    struct termios tty;
    int fd;

    // Open serial port
    fd = open(config->port, O_RDWR | O_NOCTTY | O_NONBLOCK);
    if (fd < 0) {
        DBG_ERROR("Failed to open serial port %s", config->port);
        return -1;
    }

    // Get current port settings
    if (tcgetattr(fd, &tty) != 0) {
        DBG_ERROR("Failed to get port settings");
        close(fd);
        return -1;
    }

    // Set baud rate
    speed_t speed;
    switch (config->baud_rate) {
        case 9600:   speed = B9600;   break;
        case 19200:  speed = B19200;  break;
        case 38400:  speed = B38400;  break;
        case 57600:  speed = B57600;  break;
        case 115200: speed = B115200; break;
        default:
            DBG_ERROR("Unsupported baud rate: %d", config->baud_rate);
            close(fd);
            return -1;
    }
    cfsetispeed(&tty, speed);
    cfsetospeed(&tty, speed);

    // Set data bits
    tty.c_cflag &= ~CSIZE;   // Clear size bits
    switch (config->data_bits) {
        case 5: tty.c_cflag |= CS5; break;
        case 6: tty.c_cflag |= CS6; break;
        case 7: tty.c_cflag |= CS7; break;
        case 8: tty.c_cflag |= CS8; break;
        default:
            DBG_ERROR("Unsupported data bits: %d", config->data_bits);
            close(fd);
            return -1;
    }

    // Set stop bits
    if (config->stop_bits == 2) {
        tty.c_cflag |= CSTOPB;  // 2 stop bits
    } else {
        tty.c_cflag &= ~CSTOPB; // 1 stop bit
    }

    // Set parity
    switch (config->parity) {
        case 0: // None
            tty.c_cflag &= ~PARENB;
            tty.c_cflag &= ~PARODD;
            break;
        case 1: // Odd
            tty.c_cflag |= PARENB;
            tty.c_cflag |= PARODD;
            break;
        case 2: // Even
            tty.c_cflag |= PARENB;
            tty.c_cflag &= ~PARODD;
            break;
        default:
            DBG_ERROR("Unsupported parity: %d", config->parity);
            close(fd);
            return -1;
    }

    // Set flow control
    switch (config->flow_control) {
        case 0: // None
            tty.c_cflag &= ~CRTSCTS;
            tty.c_iflag &= ~(IXON | IXOFF | IXANY);
            break;
        case 1: // Hardware (RTS/CTS)
            tty.c_cflag |= CRTSCTS;
            tty.c_iflag &= ~(IXON | IXOFF | IXANY);
            break;
        case 2: // Software (XON/XOFF)
    tty.c_cflag &= ~CRTSCTS;
            tty.c_iflag |= (IXON | IXOFF | IXANY);
            break;
        default:
            DBG_ERROR("Unsupported flow control: %d", config->flow_control);
            close(fd);
            return -1;
    }

    // Enable receiver, ignore modem control lines
    tty.c_cflag |= CREAD | CLOCAL;

    // Raw mode
    tty.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG);
    tty.c_iflag &= ~(IXON | IXOFF | IXANY);
    tty.c_oflag &= ~OPOST;

    // Set read timeout
    tty.c_cc[VMIN] = 0;      // No minimum characters
    tty.c_cc[VTIME] = 0;     // Convert ms to deciseconds

    // Apply settings
    if (tcsetattr(fd, TCSANOW, &tty) != 0) {
        DBG_ERROR("Failed to set port settings");
        close(fd);
        return -1;
    }

    // Store port information
    config->fd = fd;
    config->is_open = true;

    // Allocate write buffer
    if (!allocate_write_buffer(config)) {
        DBG_ERROR("Failed to allocate write buffer for port %s", config->port);
        close(fd);
        config->is_open = false;
        config->fd = -1;
        return -1;
    }

    DBG_INFO("Serial port %s opened with settings: baud=%d, data=%d, stop=%d, parity=%d, flow=%d", 
             config->port, config->baud_rate, config->data_bits, config->stop_bits, config->parity, config->flow_control);
    return port_index;
}

// Read data from serial port
int serial_read(int port_index, uint8_t *buf, int len, int timeout_ms, int byte_timeout_ms) {
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index");
        return -1;
    }

    serial_config_t *config = &g_serial_configs[port_index];
    if (!config->is_open || config->fd < 0) {
        DBG_ERROR("Port is not open");
        return -1;
    }

    fd_set rdset;
    struct timeval tv;
    int ret;
    int total_read = 0;
    int remaining = len;

    while (remaining > 0) {
    FD_ZERO(&rdset);
        FD_SET(config->fd, &rdset);

        tv.tv_sec = timeout_ms / 1000;
        tv.tv_usec = (timeout_ms % 1000) * 1000;
        ret = select(config->fd + 1, &rdset, NULL, NULL, &tv);
    if (ret < 0) {
        DBG_ERROR("Select error");
        return -1;
    }
    if (ret == 0) {
            if (total_read > 0) {
                // If we've read some data and hit byte timeout, return what we have
                DBG_DEBUG("Byte timeout after reading %d bytes", total_read);
                return total_read;
            }
            DBG_WARN("No data available within timeout");
        return 0;
    }

        ret = read(config->fd, buf + total_read, remaining);
    if (ret < 0) {
        DBG_ERROR("Read error");
        return -1;
        }
        if (ret == 0) {
            // Connection closed
            return total_read;
        }

        total_read += ret;
        remaining -= ret;

        // Use byte timeout for subsequent reads
        timeout_ms = byte_timeout_ms;
    }

    return total_read;
}

// Write data to serial port
int serial_write(int port_index, const uint8_t *buf, int len) {
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index");
        return -1;
    }

    serial_config_t *config = &g_serial_configs[port_index];
    if (!config->is_open || config->fd < 0) {
        DBG_ERROR("Port is not open");
        return -1;
    }

    if (!buf || len <= 0) {
        DBG_ERROR("Invalid parameters");
        return -1;
    }

    if (!config->write_buffer) {
        DBG_ERROR("Write buffer not allocated");
        return -1;
    }
    
    int total_written = 0;
    int remaining = len;
    const uint8_t *current = buf;

    while (remaining > 0) {
        // Calculate available space in buffer
        int available = config->buffer_size - config->write_buffer_pos;
        int to_copy = (remaining < available) ? remaining : available;

        // Copy data to write buffer
        memcpy(config->write_buffer + config->write_buffer_pos, current, to_copy);
        config->write_buffer_pos += to_copy;
        current += to_copy;
        remaining -= to_copy;
        total_written += to_copy;

        // Check if buffer should be flushed
        if (should_flush_buffer(config)) {
            int ret = flush_write_buffer(config);
            if (ret < 0) {
                DBG_ERROR("Failed to flush write buffer");
    return ret;
            }
        }
    }

    return total_written;
}

// Flush serial port buffers
void serial_flush(int port_index) {
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index");
        return;
    }

    serial_config_t *config = &g_serial_configs[port_index];
    if (!config->is_open || config->fd < 0) {
        DBG_ERROR("Port is not open");
        return;
    }
    
    // Flush write buffer if there's data
    if (config->write_buffer && config->write_buffer_pos > 0) {
        flush_write_buffer(config);
    }

    // Flush both input and output buffers
    if (tcflush(config->fd, TCIOFLUSH) < 0) {
        DBG_ERROR("Failed to flush serial buffers");
    }
}

// Flush serial receive buffer only
void serial_flush_rx(int port_index) {
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index");
        return;
    }

    serial_config_t *config = &g_serial_configs[port_index];
    if (!config->is_open || config->fd < 0) {
        DBG_ERROR("Port is not open");
        return;
    }

    // Flush only input buffer
    if (tcflush(config->fd, TCIFLUSH) < 0) {
        DBG_ERROR("Failed to flush receive buffer");
    }
}

// Close serial port
void serial_close(int port_index) {
    if (port_index < 0 || port_index >= MAX_SERIAL_PORTS) {
        DBG_ERROR("Invalid port index");
        return;
    }

    serial_config_t *config = &g_serial_configs[port_index];
    if (!config->is_open || config->fd < 0) {
        DBG_ERROR("Port is not open");
        return;
    }

    // Flush any remaining data
    if (config->write_buffer && config->write_buffer_pos > 0) {
        flush_write_buffer(config);
    }
    
    // Free write buffer
    free_write_buffer(config);
    
    close(config->fd);
    config->fd = -1;
    config->is_open = false;
    DBG_INFO("Serial port %s closed", config->port);
}

// Close all serial ports
void serial_close_all(void) {
    for (int i = 0; i < MAX_SERIAL_PORTS; i++) {
        if (g_serial_configs[i].is_open) {
            // Flush any remaining data
            if (g_serial_configs[i].write_buffer && g_serial_configs[i].write_buffer_pos > 0) {
                flush_write_buffer(&g_serial_configs[i]);
            }
            
            // Free write buffer
            free_write_buffer(&g_serial_configs[i]);
            
            close(g_serial_configs[i].fd);
            g_serial_configs[i].fd = -1;
            g_serial_configs[i].is_open = false;
            DBG_INFO("Serial port %s closed", g_serial_configs[i].port);
        }
    }
}


