#ifndef DEVICE_H
#define DEVICE_H

#include <stdbool.h>
#include <stdint.h>
#include "serial.h"

#define MODBUS_RTU_TIMEOUT 1000
#define MODBUS_POLLING_INTERVAL 1000
#define MODBUS_MAX_REGISTERS 125
#define MAX_SERVER_ADDRESS 64
#define MIN_SLAVE_ADDRESS 1
#define MAX_SLAVE_ADDRESS 247
#define MAX_FORMULA_LENGTH 256

// Port type enumeration
typedef enum {
    PORT_SERIAL_1 = 0,
    PORT_SERIAL_2 = 1,
    PORT_ETHERNET = 2,
    PORT_IO = 3,
    PORT_VIRTUAL = 4
} port_type_t;

// Protocol enumeration
typedef enum {
    PROTOCOL_MODBUS = 0,
    PROTOCOL_DLT645 = 1
} protocol_t;

typedef enum {
    FUNCTION_CODE_READ_COILS = 1,
    FUNCTION_CODE_READ_DISCRETE_INPUTS = 2,
    FUNCTION_CODE_READ_HOLDING_REGISTERS = 3,
    FUNCTION_CODE_READ_INPUT_REGISTERS = 4,
} function_code_t;

// Data type enumeration
typedef enum {
    DATA_TYPE_BOOLEAN = 1,
    DATA_TYPE_INT8 = 2,
    DATA_TYPE_UINT8 = 3,
    DATA_TYPE_INT16 = 4,
    DATA_TYPE_UINT16 = 5,
    DATA_TYPE_INT32_ABCD = 6,
    DATA_TYPE_INT32_CDAB = 7,
    DATA_TYPE_UINT32_ABCD = 8,
    DATA_TYPE_UINT32_CDAB = 9,
    DATA_TYPE_FLOAT_ABCD = 10,
    DATA_TYPE_FLOAT_CDAB = 11,
    DATA_TYPE_DOUBLE = 12
} data_type_t;

// Union to store different data types
typedef union {
    bool bool_val;
    int8_t int8_val;
    uint8_t uint8_val;
    int16_t int16_val;
    uint16_t uint16_val;
    int32_t int32_val;
    uint32_t uint32_val;
    float float_val;
    double double_val;
} node_value_t;

// Structure for a single node
typedef struct node {
    char *name;                          // Node name
    uint16_t address;                    // Modbus address
    function_code_t function;            // Modbus function code
    data_type_t data_type;               // Data type (boolean, int8, uint8, int16, uint16, int32, uint32, float, double)
    uint32_t timeout;                    // Timeout in milliseconds for serial read
    node_value_t value;                  // Store the converted value (present value)
    node_value_t previous_value;         // Store the previous value for reporting comparison
    struct node *next;                   // Pointer to the next node in the linked list
    uint16_t offset;                     // Offset in the merged data array
    bool is_ok;                         // Node status (true = valid, false = invalid)
    bool enable_reporting;              // Enable reporting on change
    uint16_t variation_range;           // Variation range for reporting
    bool enable_mapping;                // Enable address mapping
    uint16_t mapped_address;            // Mapped node address
    char *formula;                      // Calculation formula
    uint8_t read_status;                // Read status (0 = success, 1 = timeout, 2 = error)
} node_t;

// Structure for merged nodes with same function code
typedef struct node_group {
    function_code_t function;   // Function code for this group
    uint16_t start_address;     // Starting address of the merged range
    uint16_t register_count;    // Total number of registers to read
    node_t *nodes;             // Linked list of nodes in this group
    uint16_t *data_buffer;     // Buffer to store raw data for all nodes
    uint32_t timeout;          // Maximum timeout value of nodes in this group
    struct node_group *next;   // Next group in the list
} node_group_t;

// Device structure to store device configuration with linked list of nodes
typedef struct device {
    char *name;                   // Device name
    uint8_t device_addr;          // Device address
    uint32_t polling_interval;    // Polling interval in milliseconds
    bool group_mode;              // True for group polling, false for basic polling
    port_type_t port;             // Serial port number (1-4)
    protocol_t protocol;          // Protocol type (RTU/TCP)
    char *server_address;         // Server address for TCP
    uint16_t server_port;         // Server port for TCP (255-65535)
    bool enable_mapping;          // Enable address mapping
    uint8_t mapped_slave_addr;    // Mapped slave address (1-247)
    node_t *nodes;               // Original list of nodes
    node_group_t *groups;        // List of merged node groups (used when group_mode is true)
    struct device *next;         // Next device in the list
    int fd;                      // File descriptor for the serial port
    // Serial port configuration
    serial_config_t* serial;     // Serial port configuration for this device
} device_t;

// Function declarations
void device_init(void);
device_t* device_get_config(void);

int get_register_count(data_type_t data_type);

#endif