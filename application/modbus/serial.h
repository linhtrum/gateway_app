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
    int fd;                 // File descriptor for the serial port
    bool is_open;          // Port open status
    
    // Buffer management
    uint8_t *write_buffer;  // Buffer for write operations
    int write_buffer_pos;   // Current position in write buffer
    int last_write_time;    // Last write operation timestamp
} serial_config_t;

#define MAX_SERIAL_PORTS 2
#define MAX_BUFFER_SIZE 1460  // Maximum buffer size for any port

// Serial configuration functions
void serial_init(void);
serial_config_t* serial_get_config(int port_index);

// Serial port functions
int serial_open(int port_index);
int serial_receive(int fd, uint8_t *buf, int bufsz, int timeout);
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms, int byte_timeout_ms);
int serial_write(int fd, const uint8_t *buf, int len);
void serial_flush(int fd);
void serial_flush_rx(int fd);
void serial_close(int port_index);
void serial_close_all(void);

#endif
