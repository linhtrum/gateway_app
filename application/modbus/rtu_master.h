#ifndef RTU_MASTER_H
#define RTU_MASTER_H

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "agile_modbus.h"
#include "device.h"

#define MODBUS_MAX_ADU_LENGTH 256

// Error codes
#define RTU_MASTER_OK          0
#define RTU_MASTER_ERROR      -1
#define RTU_MASTER_TIMEOUT    -2
#define RTU_MASTER_INVALID    -3

// Function declarations
int rtu_master_init(const char *port, int baud);
void rtu_master_poll(agile_modbus_t *ctx,int fd, device_t *config);
void start_rtu_master(void);
int get_node_value(const char *node_name, float *value);
#endif
