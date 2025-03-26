#include <fcntl.h>
#include <termios.h>
#include <unistd.h>
#include <pthread.h>
#include <time.h>
#include "rtu_master.h"
#include "agile_modbus.h"
#include "serial.h"
#include "cJSON.h"
#include "db.h"
#include "../web_server/net.h"
#include "../web_server/websocket.h"
#include "../log/log_output.h"
#include "../system/management.h"

#define DBG_TAG "RTU_MASTER"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define DEFAULT_PORT "/dev/ttymxc1"
#define DEFAULT_BAUD 115200

static int method_ws_log = 0; 

static char* build_node_json(const char *node_name, node_t *node);

// Convert raw data based on data type with bounds checking
static int convert_node_value(node_t *node, uint16_t *raw_data) {
    if (!node || !raw_data) return RTU_MASTER_INVALID;
    
    switch (node->data_type) {
        case DATA_TYPE_BOOLEAN:
            if (node->function == 1 || node->function == 2) {
                // For coils and discrete inputs, each bit is expanded to a uint8_t
                node->value.bool_val = (((uint8_t *)raw_data)[0] != 0);
            } else {
                node->value.bool_val = (raw_data[0] != 0);
            }
            break;

        case DATA_TYPE_INT8:
            node->value.int8_val = (int8_t)raw_data[0];
            break;

        case DATA_TYPE_UINT8:
            node->value.uint8_val = (uint8_t)raw_data[0];
            break;

        case DATA_TYPE_INT16:
            node->value.int16_val = (int16_t)raw_data[0];
            break;

        case DATA_TYPE_UINT16:
            node->value.uint16_val = raw_data[0];
            break;

        case DATA_TYPE_INT32_ABCD:
        case DATA_TYPE_INT32_CDAB: {
            uint32_t temp = (node->data_type == DATA_TYPE_INT32_ABCD) ?
                ((uint32_t)raw_data[0] << 16) | raw_data[1] :
                ((uint32_t)raw_data[1] << 16) | raw_data[0];
            node->value.int32_val = (int32_t)temp;
            break;
        }

        case DATA_TYPE_UINT32_ABCD:
        case DATA_TYPE_UINT32_CDAB:
            node->value.uint32_val = (node->data_type == DATA_TYPE_UINT32_ABCD) ?
                ((uint32_t)raw_data[0] << 16) | raw_data[1] :
                ((uint32_t)raw_data[1] << 16) | raw_data[0];
            break;

        case DATA_TYPE_FLOAT_ABCD:
        case DATA_TYPE_FLOAT_CDAB: {
            uint32_t temp = (node->data_type == DATA_TYPE_FLOAT_ABCD) ?
                ((uint32_t)raw_data[0] << 16) | raw_data[1] :
                ((uint32_t)raw_data[1] << 16) | raw_data[0];
            memcpy(&node->value.float_val, &temp, sizeof(float));
            break;
        }

        case DATA_TYPE_DOUBLE: {
            uint64_t temp = ((uint64_t)raw_data[0] << 48) |
                           ((uint64_t)raw_data[1] << 32) |
                           ((uint64_t)raw_data[2] << 16) |
                           raw_data[3];
            memcpy(&node->value.double_val, &temp, sizeof(double));
            break;
        }

        default:
            return RTU_MASTER_INVALID;
    }
    
    return RTU_MASTER_OK;
}

// Convert byte array to hex string and send via websocket
static void send_hex_string(const uint8_t *data, int len) {
    if (!data || len <= 0) return;

    // Each byte needs 4 chars (0x + 2 hex chars) plus 1 space, and 1 null terminator
    char *hex_str = calloc(len * 5 + 1, sizeof(char));
    if (!hex_str) {
        DBG_ERROR("Failed to allocate memory for hex string");
        return;
    }

    // Convert each byte to hex chars with 0x prefix
    int pos = 0;
    for (int i = 0; i < len; i++) {
        pos += snprintf(hex_str + pos, 6, "0x%02X ", data[i]);
    }

    // Remove trailing space and null terminate
    if (pos > 0) {
        hex_str[pos-1] = '\0';
    } else {
        hex_str[0] = '\0';
    }

    // Send via websocket
    websocket_log_send(hex_str);
    
    free(hex_str);
}

// Poll a single node with improved error handling
static int poll_single_node(agile_modbus_t *ctx, int fd, device_t *device, node_t *node) {
    if (!ctx || fd < 0 || !device || !node) return RTU_MASTER_INVALID;

    uint16_t data[4] = {0};  // Buffer for all data types
    int rc;
    int reg_count = get_register_count(node->data_type);
    
    // Send Modbus request based on function code
    switch(node->function) {
        case 1: // Read coils
            rc = agile_modbus_serialize_read_bits(ctx, node->address, reg_count);
            break;
        case 2: // Read discrete inputs
            rc = agile_modbus_serialize_read_input_bits(ctx, node->address, reg_count);
            break;
        case 3: // Read holding registers
            rc = agile_modbus_serialize_read_registers(ctx, node->address, reg_count);
            break;
        case 4: // Read input registers
            rc = agile_modbus_serialize_read_input_registers(ctx, node->address, reg_count);
            break;
        default:
            DBG_ERROR("Unsupported function code: %d", node->function);
            return RTU_MASTER_INVALID;
    }

    if (rc <= 0) {
        DBG_ERROR("Failed to serialize request for node %s", node->name);
        return RTU_MASTER_ERROR;
    }

    // Send request
    serial_flush(fd);
    int send_len = serial_write(fd, ctx->send_buf, rc);
    if (send_len != rc) {
        DBG_ERROR("Failed to send request for node %s", node->name);
        return RTU_MASTER_ERROR;
    }

    // Read response with node-specific timeout
    int read_len = serial_receive(fd, ctx->read_buf, ctx->read_bufsz, node->timeout);
    if (read_len < 0) {
        DBG_ERROR("Failed to read response for node %s (timeout: %dms)", 
                 node->name, node->timeout);
        return RTU_MASTER_TIMEOUT;
    }

    if (read_len > 0) {
        if(method_ws_log == 1)
        {
            // Send hex string of response data
            send_hex_string(ctx->read_buf, read_len);
        }

        // Process response based on function code
        switch(node->function) {
            case 1: // Read coils
                rc = agile_modbus_deserialize_read_bits(ctx, read_len, (uint8_t *)data);
                break;
            case 2: // Read discrete inputs
                rc = agile_modbus_deserialize_read_input_bits(ctx, read_len, (uint8_t *)data);
                break;
            case 3: // Read holding registers
                rc = agile_modbus_deserialize_read_registers(ctx, read_len, data);
                break;
            case 4: // Read input registers
                rc = agile_modbus_deserialize_read_input_registers(ctx, read_len, data);
                break;
        }

        if (rc < 0) {
            DBG_ERROR("Failed to deserialize response for node %s", node->name);
            return RTU_MASTER_ERROR;
        }

        // Convert and store the value
        if (convert_node_value(node, data) == RTU_MASTER_OK) {
            // Log the converted value with type-specific formatting
            switch (node->data_type) {
                case DATA_TYPE_BOOLEAN:
                    DBG_INFO("%s.%s = %d", device->name, node->name, node->value.bool_val);
                    break;
                case DATA_TYPE_INT8:
                    DBG_INFO("%s.%s = %d", device->name, node->name, node->value.int8_val);
                    break;
                case DATA_TYPE_UINT8:
                    DBG_INFO("%s.%s = %u", device->name, node->name, node->value.uint8_val);
                    break;
                case DATA_TYPE_INT16:
                    DBG_INFO("%s.%s = %d", device->name, node->name, node->value.int16_val);
                    break;
                case DATA_TYPE_UINT16:
                    DBG_INFO("%s.%s = %u", device->name, node->name, node->value.uint16_val);
                    break;
                case DATA_TYPE_INT32_ABCD:
                case DATA_TYPE_INT32_CDAB:
                    DBG_INFO("%s.%s = %ld", device->name, node->name, node->value.int32_val);
                    break;
                case DATA_TYPE_UINT32_ABCD:
                case DATA_TYPE_UINT32_CDAB:
                    DBG_INFO("%s.%s = %lu", device->name, node->name, node->value.uint32_val);
                    break;
                case DATA_TYPE_FLOAT_ABCD:
                case DATA_TYPE_FLOAT_CDAB:
                    DBG_INFO("%s.%s = %.6f", device->name, node->name, node->value.float_val);
                    break;
                case DATA_TYPE_DOUBLE:
                    DBG_INFO("%s.%s = %.12lf", device->name, node->name, node->value.double_val);
                    break;
            }

            // Send websocket update
            char *json_msg = build_node_json(node->name, node);
            if (json_msg) {
                send_websocket_message(json_msg);
                free(json_msg);
            }

            return RTU_MASTER_OK;
        }
    }

    return RTU_MASTER_ERROR;
}

// Poll a group of nodes with the same function code
static int poll_group_node(agile_modbus_t *ctx, int fd, device_t *device, node_group_t *group) {
    if (!ctx || fd < 0 || !device || !group) return RTU_MASTER_INVALID;

    int rc;
    
    // Send Modbus request based on function code
    switch(group->function) {
        case 1: // Read coils
            rc = agile_modbus_serialize_read_bits(ctx, group->start_address, 
                                                group->register_count);
            break;
        case 2: // Read discrete inputs
            rc = agile_modbus_serialize_read_input_bits(ctx, group->start_address, 
                                                      group->register_count);
            break;
        case 3: // Read holding registers
            rc = agile_modbus_serialize_read_registers(ctx, group->start_address, 
                                                     group->register_count);
            break;
        case 4: // Read input registers
            rc = agile_modbus_serialize_read_input_registers(ctx, group->start_address, 
                                                           group->register_count);
            break;
        default:
            DBG_ERROR("Unsupported function code: %d", group->function);
            return RTU_MASTER_INVALID;
    }

    if (rc <= 0) {
        DBG_ERROR("Failed to serialize request for group (function: %d, start: %d)",
                 group->function, group->start_address);
        return RTU_MASTER_ERROR;
    }

    // Send request
    serial_flush(fd);
    int send_len = serial_write(fd, ctx->send_buf, rc);
    if (send_len != rc) {
        DBG_ERROR("Failed to send request for group (function: %d, start: %d)",
                 group->function, group->start_address);
        return RTU_MASTER_ERROR;
    }

    // Read response
    int read_len = serial_receive(fd, ctx->read_buf, ctx->read_bufsz, 
                             MODBUS_RTU_TIMEOUT);
    if (read_len < 0) {
        DBG_ERROR("Failed to read response for group (function: %d, start: %d)", 
                 group->function, group->start_address);
        return RTU_MASTER_TIMEOUT;
    }

    if (read_len > 0) {
        if(method_ws_log == 1)
        {
            // Send hex string of response data
            send_hex_string(ctx->read_buf, read_len);
        }

        // Process response based on function code
        switch(group->function) {
            case 1: // Read coils
                rc = agile_modbus_deserialize_read_bits(ctx, read_len, (uint8_t *)group->data_buffer);
                break;
            case 2: // Read discrete inputs
                rc = agile_modbus_deserialize_read_input_bits(ctx, read_len, (uint8_t *)group->data_buffer);
                break;
            case 3: // Read holding registers
                rc = agile_modbus_deserialize_read_registers(ctx, read_len, group->data_buffer);
                break;
            case 4: // Read input registers
                rc = agile_modbus_deserialize_read_input_registers(ctx, read_len, group->data_buffer);
                break;
        }

        if (rc < 0) {
            DBG_ERROR("Failed to deserialize response for group (function: %d, start: %d)",
                     group->function, group->start_address);
            return RTU_MASTER_ERROR;
        }

        // Update values for all nodes in the group
        node_t *node = group->nodes;
        while (node && node->function == group->function) {
            // For coils and discrete inputs, each bit is returned as a byte
            uint16_t *data_ptr;
            if (node->function == 1 || node->function == 2) {
                // For bit functions, offset is in bits but data is in bytes
                data_ptr = (uint16_t *)&((uint8_t *)group->data_buffer)[node->offset];
            } else {
                // For register functions, offset is in registers
                data_ptr = &group->data_buffer[node->offset];
            }

            // Convert and store the value using the node's offset
            int convert_result = convert_node_value(node, data_ptr);
            if (convert_result != RTU_MASTER_OK) {
                DBG_ERROR("Failed to convert value for node %s in group", node->name);
                return convert_result;
            }
            
            // Log the converted value
            switch (node->data_type) {
                case DATA_TYPE_BOOLEAN:
                    DBG_INFO("Device: %s, Node: %s, Value: %d", 
                            device->name, node->name, node->value.bool_val);
                    break;
                case DATA_TYPE_INT8:
                    DBG_INFO("Device: %s, Node: %s, Value: %d", 
                            device->name, node->name, node->value.int8_val);
                    break;
                case DATA_TYPE_UINT8:
                    DBG_INFO("Device: %s, Node: %s, Value: %d", 
                            device->name, node->name, node->value.uint8_val);
                    break;
                case DATA_TYPE_INT16:
                    DBG_INFO("Device: %s, Node: %s, Value: %d", 
                            device->name, node->name, node->value.int16_val);
                    break;
                case DATA_TYPE_UINT16:
                    DBG_INFO("Device: %s, Node: %s, Value: %d", 
                            device->name, node->name, node->value.uint16_val);
                    break;
                case DATA_TYPE_INT32_ABCD:
                case DATA_TYPE_INT32_CDAB:
                    DBG_INFO("Device: %s, Node: %s, Value: %ld", 
                            device->name, node->name, node->value.int32_val);
                    break;
                case DATA_TYPE_UINT32_ABCD:
                case DATA_TYPE_UINT32_CDAB:
                    DBG_INFO("Device: %s, Node: %s, Value: %lu", 
                            device->name, node->name, node->value.uint32_val);
                    break;
                case DATA_TYPE_FLOAT_ABCD:
                case DATA_TYPE_FLOAT_CDAB:
                    DBG_INFO("Device: %s, Node: %s, Value: %.6f", 
                            device->name, node->name, node->value.float_val);
                    break;
                case DATA_TYPE_DOUBLE:
                    DBG_INFO("Device: %s, Node: %s, Value: %.12lf", 
                            device->name, node->name, node->value.double_val);
                    break;
            }

            // Send websocket update
            char *json_msg = build_node_json(node->name, node);
            if (json_msg) {
                send_websocket_message(json_msg);
                free(json_msg);
            }
            
            node = node->next;
        }
        return RTU_MASTER_OK;
    }

    return RTU_MASTER_ERROR;
}

// Build JSON message from node data
static char* build_node_json(const char *node_name, node_t *node) {
    if (!node_name || !node) {
        DBG_ERROR("Invalid parameters for building JSON");
        return NULL;
    }

    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON object");
        return NULL;
    }

    // Add type field
    cJSON_AddStringToObject(root, "type", "update");
    
    // Add node name
    cJSON_AddStringToObject(root, "n", node_name);

    // Add value based on data type
    switch (node->data_type) {
        case DATA_TYPE_BOOLEAN:
            cJSON_AddBoolToObject(root, "v", node->value.bool_val);
            break;
        case DATA_TYPE_INT8:
            cJSON_AddNumberToObject(root, "v", node->value.int8_val);
            break;
        case DATA_TYPE_UINT8:
            cJSON_AddNumberToObject(root, "v", node->value.uint8_val);
            break;
        case DATA_TYPE_INT16:
            cJSON_AddNumberToObject(root, "v", node->value.int16_val);
            break;
        case DATA_TYPE_UINT16:
            cJSON_AddNumberToObject(root, "v", node->value.uint16_val);
            break;
        case DATA_TYPE_INT32_ABCD:
        case DATA_TYPE_INT32_CDAB:
            cJSON_AddNumberToObject(root, "v", node->value.int32_val);
            break;
        case DATA_TYPE_UINT32_ABCD:
        case DATA_TYPE_UINT32_CDAB:
            cJSON_AddNumberToObject(root, "v", node->value.uint32_val);
            break;
        case DATA_TYPE_FLOAT_ABCD:
        case DATA_TYPE_FLOAT_CDAB:
            cJSON_AddNumberToObject(root, "v", node->value.float_val);
            break;
        case DATA_TYPE_DOUBLE:
            cJSON_AddNumberToObject(root, "v", node->value.double_val);
            break;
        default:
            DBG_ERROR("Unsupported data type: %d", node->data_type);
            cJSON_Delete(root);
            return NULL;
    }

    // Convert to string
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) {
        DBG_ERROR("Failed to convert JSON to string");
        return NULL;
    }

    return json_str;
}

// Initialize Modbus RTU master with improved error handling
int rtu_master_init(const char *port, int baud) {
    if (!port) {
        DBG_ERROR("Invalid port parameter");
        return RTU_MASTER_INVALID;
    }

    int fd = serial_open(port, baud);
    if (fd < 0) {
        DBG_ERROR("Failed to open serial port %s at %d baud", port, baud);
        return RTU_MASTER_ERROR;
    }
       
    DBG_INFO("Modbus RTU master initialized on %s at %d baud", port, baud);
    return fd;
}

void rtu_master_poll(agile_modbus_t *ctx, int fd, device_t *config) {
    if (!config || fd < 0 || !ctx) {
        DBG_ERROR("Invalid parameters for polling");
        return;
    }

    device_t *current_device = config;
    while (current_device) {
        DBG_INFO("Polling device: %s (interval: %dms, mode: %s)", 
                 current_device->name, 
                 current_device->polling_interval,
                 current_device->group_mode ? "group" : "basic");
        
        agile_modbus_set_slave(ctx, current_device->device_addr);
        
        if (current_device->group_mode) {
            // Poll each group
            node_group_t *current_group = current_device->groups;
            while (current_group) {
                int result = poll_group_node(ctx, fd, current_device, current_group);
                if (result != RTU_MASTER_OK) {
                    DBG_ERROR("Failed to poll group %d (error: %d)", 
                             current_group->function, result);
                }
                // Sleep after each group poll
                usleep(current_device->polling_interval * 1000);
                current_group = current_group->next;
            }
        } else {
            // Basic polling mode - poll each node individually
            node_t *current_node = current_device->nodes;
            while (current_node) {
                int result = poll_single_node(ctx, fd, current_device, current_node);
                if (result != RTU_MASTER_OK) {
                    DBG_ERROR("Failed to poll node %s (error: %d)", 
                             current_node->name, result);
                }
                // Sleep after each node poll
                usleep(current_device->polling_interval * 1000);
                current_node = current_node->next;
            }
        }
        
        current_device = current_device->next;
    }
}

static void *rtu_master_thread(void *arg) {
    int fd;
    uint8_t master_send_buf[MODBUS_MAX_ADU_LENGTH];
    uint8_t master_recv_buf[MODBUS_MAX_ADU_LENGTH];

    agile_modbus_rtu_t ctx_rtu;
    agile_modbus_t *ctx = &ctx_rtu._ctx;

    agile_modbus_rtu_init(&ctx_rtu, master_send_buf, sizeof(master_send_buf),
                         master_recv_buf, sizeof(master_recv_buf));
    
    device_t *device_config = device_get_config();
    if (!device_config) {
        DBG_ERROR("Invalid configuration for RTU master thread");
        goto exit;
    }

    // Initialize serial port
    fd = rtu_master_init(DEFAULT_PORT, DEFAULT_BAUD);
    if (fd < 0) {
        DBG_ERROR("Failed to initialize RTU master");
        goto exit;
    }

    DBG_INFO("RTU master polling thread started");

    method_ws_log = management_get_log_method();

    // Run continuously
    while (1) {
        // Poll all devices (each device handles its own polling interval)
        rtu_master_poll(ctx, fd, device_config);
    }

    exit:
    if(device_config) {
        free_device_config(device_config);
    }

    if(fd >= 0) {
        serial_close(fd);
    }

    return NULL;
}

void start_rtu_master(void) {
    pthread_t thread;
    pthread_attr_t attr;
    
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    
    int ret = pthread_create(&thread, &attr, rtu_master_thread, NULL);
    if (ret != 0) {
        DBG_ERROR("Failed to create RTU master thread: %s", strerror(ret));
    }
    
    pthread_attr_destroy(&attr);
}

// Get node value by node name
int get_node_value(const char *node_name, float *value) {
    if (!node_name || !value) {
        DBG_ERROR("Invalid parameters for get_node_value");
        return RTU_MASTER_INVALID;
    }

    // Find the node in device configuration
    device_t *current_device = device_get_config();
    if (!current_device) {
        DBG_ERROR("Failed to get device configuration");
        return RTU_MASTER_ERROR;
    }

    // Search through all devices and nodes
    while (current_device) {
        node_t *current_node = current_device->nodes;
        while (current_node) {
            if (strcmp(current_node->name, node_name) == 0) {
                // Convert node value to float based on data type
                switch (current_node->data_type) {
                    case DATA_TYPE_BOOLEAN:
                        *value = (float)current_node->value.bool_val;
                        break;
                    case DATA_TYPE_INT8:
                        *value = (float)current_node->value.int8_val;
                        break;
                    case DATA_TYPE_UINT8:
                        *value = (float)current_node->value.uint8_val;
                        break;
                    case DATA_TYPE_INT16:
                        *value = (float)current_node->value.int16_val;
                        break;
                    case DATA_TYPE_UINT16:
                        *value = (float)current_node->value.uint16_val;
                        break;
                    case DATA_TYPE_INT32_ABCD:
                    case DATA_TYPE_INT32_CDAB:
                        *value = (float)current_node->value.int32_val;
                        break;
                    case DATA_TYPE_UINT32_ABCD:
                    case DATA_TYPE_UINT32_CDAB:
                        *value = (float)current_node->value.uint32_val;
                        break;
                    case DATA_TYPE_FLOAT_ABCD:
                    case DATA_TYPE_FLOAT_CDAB:
                        *value = current_node->value.float_val;
                        break;
                    case DATA_TYPE_DOUBLE:
                        *value = (float)current_node->value.double_val;
                        break;
                    default:
                        DBG_ERROR("Unsupported data type for node: %s", node_name);
                        return RTU_MASTER_INVALID;
                }
                return RTU_MASTER_OK;
            }
            current_node = current_node->next;
        }
        device_t *next_device = current_device->next;
        current_device = next_device;
    }

    DBG_ERROR("Node not found: %s", node_name);
    return RTU_MASTER_ERROR;
}
