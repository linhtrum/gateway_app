#ifndef RTU_MASTER_H
#define RTU_MASTER_H

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "agile_modbus.h"
#include "device.h"

#define MODBUS_MAX_ADU_LENGTH 256
#define MODBUS_RTU_TIMEOUT 1000

// Error codes
#define RTU_MASTER_OK          0
#define RTU_MASTER_ERROR      -1
#define RTU_MASTER_TIMEOUT    -2
#define RTU_MASTER_INVALID    -3

// Report event structure
typedef struct {
    char *node_name;
    data_type_t data_type;
    node_value_t value;
    node_value_t previous_value;
    uint64_t timestamp;
} report_event_t;

// Function declarations
int rtu_master_init(const char *port, int baud, int data_bits, int stop_bits, int parity, int flow_control);
void rtu_master_poll(agile_modbus_t *ctx, device_t *config);
void start_rtu_master_thread(void);
int get_node_value(const char *node_name, float *value);
int send_report_event(report_event_t *event);

#endif
