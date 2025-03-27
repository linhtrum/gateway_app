#ifndef SERIAL_H
#define SERIAL_H

#include <stdint.h>
#include <stdbool.h>

// Serial configuration structure
typedef struct {
    bool enabled;            // "enabled": Enable/disable serial port
    char port[32];          // "port": Serial port device path
    int baud_rate;          // "baudRate": Baud rate
    int data_bits;          // "dataBits": Number of data bits
    int stop_bits;          // "stopBits": Number of stop bits
    int parity;             // "parity": Parity setting (0: none, 1: odd, 2: even)
    int flow_control;       // "flowControl": Flow control setting (0: none, 1: hardware, 2: software)
    int timeout;            // "timeout": Read timeout in milliseconds
    int buffer_size;        // "bufferSize": Buffer size for read/write operations
} serial_config_t;

// Serial configuration functions
void serial_init(void);
serial_config_t* serial_get_config(void);
bool serial_update_config(const char *json_str);
bool serial_save_config_from_json(const char *json_str);
// Serial port functions
int serial_open(const char *port, int baud, int data_bits, int stop_bits, 
                int parity, int flow_control);
int serial_receive(int fd, uint8_t *buf, int bufsz, int timeout);
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms);
int serial_write(int fd, const uint8_t *buf, int len);
void serial_flush(int fd);
void serial_close(int fd);

#endif
