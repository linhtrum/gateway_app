#ifndef SERIAL_CONFIG_H
#define SERIAL_CONFIG_H

#include <stdint.h>
#include <stdbool.h>

// Serial configuration structure
typedef struct {
    char port[32];          // Serial port name (e.g. "/dev/ttymxc1")
    uint32_t baudRate;      // Baud rate (e.g. 9600)
    uint8_t dataBits;       // Data bits (5-8)
    uint8_t parity;         // Parity (0=None, 1=Even, 2=Odd, 3=Mark, 4=Space)
    uint8_t stopBits;       // Stop bits (1=1, 2=1.5, 3=2)
    uint8_t flowControl;    // Flow control (0=None, 1=RTS/CTS, 2=XON/XOFF)
} serial_config_t;

// Function declarations
bool serial_config_init(void);
serial_config_t *serial_config_get(void);

#endif 