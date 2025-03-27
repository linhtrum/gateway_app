#include "serial.h"
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <termios.h>
#include <unistd.h>
#include <sys/select.h>
#include <sys/time.h>
#include <errno.h>
#include "cJSON.h"
#include "db.h"

#define DBG_TAG "SERIAL"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Static serial configuration
static serial_config_t g_serial_config = {0};

// Parse serial configuration from JSON
static bool parse_serial_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
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
        g_serial_config.enabled = cJSON_IsTrue(enabled);
    }

    cJSON *port = cJSON_GetObjectItem(root, "port");
    if (port && port->valuestring) {
        strncpy(g_serial_config.port, port->valuestring, sizeof(g_serial_config.port) - 1);
    }

    cJSON *baud_rate = cJSON_GetObjectItem(root, "baudRate");
    if (baud_rate) {
        g_serial_config.baud_rate = baud_rate->valueint;
    }

    cJSON *data_bits = cJSON_GetObjectItem(root, "dataBits");
    if (data_bits) {
        g_serial_config.data_bits = data_bits->valueint;
    }

    cJSON *stop_bits = cJSON_GetObjectItem(root, "stopBits");
    if (stop_bits) {
        g_serial_config.stop_bits = stop_bits->valueint;
    }

    cJSON *parity = cJSON_GetObjectItem(root, "parity");
    if (parity) {
        g_serial_config.parity = parity->valueint;
    }

    cJSON *flow_control = cJSON_GetObjectItem(root, "flowControl");
    if (flow_control) {
        g_serial_config.flow_control = flow_control->valueint;
    }

    cJSON *timeout = cJSON_GetObjectItem(root, "timeout");
    if (timeout) {
        g_serial_config.timeout = timeout->valueint;
    }

    cJSON *buffer_size = cJSON_GetObjectItem(root, "bufferSize");
    if (buffer_size) {
        g_serial_config.buffer_size = buffer_size->valueint;
    }

    cJSON_Delete(root);
    return true;
}

// Convert serial configuration to JSON string
static char* serial_config_to_json(void) {
    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON object");
        return NULL;
    }

    cJSON_AddBoolToObject(root, "enabled", g_serial_config.enabled);
    cJSON_AddStringToObject(root, "port", g_serial_config.port);
    cJSON_AddNumberToObject(root, "baudRate", g_serial_config.baud_rate);
    cJSON_AddNumberToObject(root, "dataBits", g_serial_config.data_bits);
    cJSON_AddNumberToObject(root, "stopBits", g_serial_config.stop_bits);
    cJSON_AddNumberToObject(root, "parity", g_serial_config.parity);
    cJSON_AddNumberToObject(root, "flowControl", g_serial_config.flow_control);
    cJSON_AddNumberToObject(root, "timeout", g_serial_config.timeout);
    cJSON_AddNumberToObject(root, "bufferSize", g_serial_config.buffer_size);

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    return json_str;
}

// Initialize serial configuration
void serial_init(void) {
    char config_str[1024] = {0};
    int read_len = db_read("serial_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read serial config from database");
        return;
    }

    if (!parse_serial_config(config_str)) {
        DBG_ERROR("Failed to parse serial config");
        return;
    }

    DBG_INFO("Serial configuration initialized: port=%s, baud=%d", 
             g_serial_config.port, g_serial_config.baud_rate);
}

// Get serial configuration
serial_config_t* serial_get_config(void) {
    return &g_serial_config;
}

// Update serial configuration
bool serial_update_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    if (!parse_serial_config(json_str)) {
        return false;
    }

    char *config_json = serial_config_to_json();
    if (!config_json) {
        return false;
    }

    bool success = (db_write("serial_config", config_json, strlen(config_json) + 1) == 0);
    free(config_json);

    if (success) {
        DBG_INFO("Serial configuration updated successfully");
    } else {
        DBG_ERROR("Failed to save serial configuration");
    }

    return success;
}

// Save serial configuration from JSON
bool serial_save_config_from_json(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    int result = db_write("serial_config", json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write serial config to database");
        return false;
    }

    return true;
}

// Open serial port
int serial_open(const char *port, int baud, int data_bits, int stop_bits, 
                int parity, int flow_control) {
    struct termios tty;
    int fd;

    // Open serial port
    fd = open(port, O_RDWR | O_NOCTTY | O_NONBLOCK);
    if (fd < 0) {
        DBG_ERROR("Failed to open serial port %s", port);
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
    switch (baud) {
        case 9600:   speed = B9600;   break;
        case 19200:  speed = B19200;  break;
        case 38400:  speed = B38400;  break;
        case 57600:  speed = B57600;  break;
        case 115200: speed = B115200; break;
        default:
            DBG_ERROR("Unsupported baud rate: %d", baud);
            close(fd);
            return -1;
    }
    cfsetispeed(&tty, speed);
    cfsetospeed(&tty, speed);

    // Set data bits
    tty.c_cflag &= ~CSIZE;   // Clear size bits
    switch (data_bits) {
        case 5: tty.c_cflag |= CS5; break;
        case 6: tty.c_cflag |= CS6; break;
        case 7: tty.c_cflag |= CS7; break;
        case 8: tty.c_cflag |= CS8; break;
        default:
            DBG_ERROR("Unsupported data bits: %d", data_bits);
            close(fd);
            return -1;
    }

    // Set stop bits
    if (stop_bits == 2) {
        tty.c_cflag |= CSTOPB;  // 2 stop bits
    } else {
        tty.c_cflag &= ~CSTOPB; // 1 stop bit
    }

    // Set parity
    switch (parity) {
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
            DBG_ERROR("Unsupported parity: %d", parity);
            close(fd);
            return -1;
    }

    // Set flow control
    switch (flow_control) {
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
            DBG_ERROR("Unsupported flow control: %d", flow_control);
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

    DBG_INFO("Serial port %s opened with settings: baud=%d, data=%d, stop=%d, parity=%d, flow=%d", 
             port, baud, data_bits, stop_bits, parity, flow_control);
    return fd;
}

// Receive data from serial port
int serial_receive(int fd, uint8_t *buf, int bufsz, int timeout){
    int len = 0;
    int rc = 0;
    fd_set rset;
    struct timeval tv;

    while (bufsz > 0) {
        FD_ZERO(&rset);
        FD_SET(fd, &rset);

        tv.tv_sec = timeout / 1000;
        tv.tv_usec = (timeout % 1000) * 1000;
        rc = select(fd + 1, &rset, NULL, NULL, &tv);
        if (rc == -1) {
            if (errno == EINTR)
                continue;
        }

        if (rc <= 0) {
            break;
        }

        rc = read(fd, buf + len, bufsz);
        if (rc <= 0) {
            break;
        }
        len += rc;
        bufsz -= rc;

        timeout = 20;
    }

    if (rc >= 0) {
        rc = len;
    }

    return rc;
}

// Read data from serial port
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms) {
    if (fd < 0) {
        DBG_ERROR("Invalid file descriptor");
        return -1;
    }

    fd_set rdset;
    struct timeval timeout;
    int ret;

    FD_ZERO(&rdset);
    FD_SET(fd, &rdset);

    timeout.tv_sec = timeout_ms / 1000;
    timeout.tv_usec = (timeout_ms % 1000) * 1000;

    ret = select(fd + 1, &rdset, NULL, NULL, &timeout);
    if (ret < 0) {
        DBG_ERROR("Select error");
        return -1;
    }
    if (ret == 0) {
        DBG_WARN("Read timeout");
        return 0;
    }

    ret = read(fd, buf, len);
    if (ret < 0) {
        DBG_ERROR("Read error");
        return -1;
    }

    return ret;
}

// Write data to serial port
int serial_write(int fd, const uint8_t *buf, int len) {
    if (fd < 0) {
        DBG_ERROR("Invalid file descriptor");
        return -1;
    }

    int ret = write(fd, buf, len);
    if (ret < 0) {
        DBG_ERROR("Write error");
        return -1;
    }
    
    // Wait for all data to be transmitted
    tcdrain(fd);

    return ret;
}

// Flush serial port buffers
void serial_flush(int fd) {
    if (fd < 0) {
        DBG_ERROR("Invalid file descriptor");
        return;
    }

    // Flush both input and output buffers
    if (tcflush(fd, TCIOFLUSH) < 0) {
        DBG_ERROR("Failed to flush serial buffers");
    }
}

// Close serial port
void serial_close(int fd) {
    if (fd >= 0) {
        close(fd);
        DBG_INFO("Serial port closed");
    }
}
