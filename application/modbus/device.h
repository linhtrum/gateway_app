#ifndef DEVICE_H
#define DEVICE_H

#include <stdbool.h>
#include <stdint.h>

#define MODBUS_RTU_TIMEOUT 1000
#define MODBUS_POLLING_INTERVAL 1000
#define MODBUS_MAX_REGISTERS 125

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
    char *name;
    uint16_t address;
    uint8_t function;
    data_type_t data_type;
    uint32_t timeout;  // Timeout in milliseconds for serial read
    node_value_t value;  // Store the converted value
    struct node *next;
    uint16_t offset;  // Offset in the merged data array
    bool is_ok;
} node_t;

// Structure for merged nodes with same function code
typedef struct node_group {
    uint8_t function;           // Function code for this group
    uint16_t start_address;     // Starting address of the merged range
    uint16_t register_count;    // Total number of registers to read
    node_t *nodes;             // Linked list of nodes in this group
    uint16_t *data_buffer;     // Buffer to store raw data for all nodes
    struct node_group *next;   // Next group in the list
} node_group_t;

// Device structure to store device configuration with linked list of nodes
typedef struct device {
    char *name;
    uint8_t device_addr;
    uint32_t polling_interval;  // Polling interval in milliseconds
    bool group_mode;           // True for group polling, false for basic polling
    node_t *nodes;             // Original list of nodes
    node_group_t *groups;      // List of merged node groups (used when group_mode is true)
    struct device *next;
} device_t;

// Function declarations
void device_init(void);
device_t* device_get_config(void);
int get_register_count(data_type_t data_type);
bool device_save_config_from_json(const char *json_str);
char *device_config_to_json(void);

#endif