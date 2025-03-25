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

#define DBG_TAG "RTU_MASTER"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define DEFAULT_PORT "/dev/ttymxc1"
#define DEFAULT_BAUD 115200

// Function declarations
static void free_node(node_t *node);
static void free_device(device_t *device);
static void free_node_group(node_group_t *group);
static void free_device_groups(device_t *device);
static int convert_node_value(node_t *node, uint16_t *raw_data);
static node_t* parse_nodes(cJSON *nodes_array);
static int get_register_count(data_type_t data_type);
static void create_node_groups(device_t *device);
static int poll_single_node(agile_modbus_t *ctx, int fd, device_t *device, node_t *node);
static int poll_group_node(agile_modbus_t *ctx, int fd, device_t *device, node_group_t *group);
static char* build_node_json(const char *node_name, node_t *node);

static uint8_t method_ws_log = 0; 

// Free memory for a node and its members
static void free_node(node_t *node) {
    if (!node) return;
    free(node->name);
    free(node);
}

// Free memory for a device and its nodes
static void free_device(device_t *device) {
    if (!device) return;
    
    // Free all nodes
    node_t *current = device->nodes;
    while (current) {
        node_t *next = current->next;
        free_node(current);
        current = next;
    }
    
    // Free groups if they exist
    free_device_groups(device);
    
    free(device->name);
    free(device);
}

// Free memory for a node group and its data buffer
static void free_node_group(node_group_t *group) {
    if (!group) return;
    free(group->data_buffer);
    free(group);
}

// Free all node groups in a device
static void free_device_groups(device_t *device) {
    if (!device) return;
    
    node_group_t *current = device->groups;
    while (current) {
        node_group_t *next = current->next;
        free_node_group(current);
        current = next;
    }
    device->groups = NULL;
}

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

// Parse node array from JSON
static node_t* parse_nodes(cJSON *nodes_array) {
    node_t *head = NULL;
    node_t *current = NULL;
    
    int node_count = cJSON_GetArraySize(nodes_array);
    for (int i = 0; i < node_count; i++) {
        cJSON *node_obj = cJSON_GetArrayItem(nodes_array, i);
        
        node_t *new_node = (node_t*)calloc(1, sizeof(node_t));
        if (!new_node) {
            DBG_ERROR("Memory allocation failed for node");
            return head;
        }

        cJSON *name = cJSON_GetObjectItem(node_obj, "n");
        cJSON *addr = cJSON_GetObjectItem(node_obj, "a");
        cJSON *func = cJSON_GetObjectItem(node_obj, "f");
        cJSON *data_type = cJSON_GetObjectItem(node_obj, "dt");
        cJSON *timeout = cJSON_GetObjectItem(node_obj, "t");

        if (name && name->valuestring) {
            new_node->name = strdup(name->valuestring);
        }
        if (addr) {
            new_node->address = addr->valueint;
        }
        if (func) {
            new_node->function = func->valueint;
        }
        if (data_type) {
            new_node->data_type = (data_type_t)data_type->valueint;
        }
        if (timeout) {
            new_node->timeout = timeout->valueint;
        } else {
            new_node->timeout = MODBUS_RTU_TIMEOUT; // Default timeout of 1 second
        }

        if (!head) {
            head = new_node;
            current = head;
        } else {
            current->next = new_node;
            current = new_node;
        }
    }

    return head;
}

// Calculate number of registers needed based on data type
static int get_register_count(data_type_t data_type) {
    switch (data_type) {
        case DATA_TYPE_BOOLEAN:
        case DATA_TYPE_INT8:
        case DATA_TYPE_UINT8:
        case DATA_TYPE_INT16:
        case DATA_TYPE_UINT16:
            return 1;
        case DATA_TYPE_INT32_ABCD:
        case DATA_TYPE_INT32_CDAB:
        case DATA_TYPE_UINT32_ABCD:
        case DATA_TYPE_UINT32_CDAB:
        case DATA_TYPE_FLOAT_ABCD:
        case DATA_TYPE_FLOAT_CDAB:
            return 2;
        case DATA_TYPE_DOUBLE:
            return 4;
        default:
            return 1;
    }
}

// Create node groups for a device based on function codes
static void create_node_groups(device_t *device) {
    if (!device || !device->nodes) return;

    // First, sort nodes by function code and address
    node_t *sorted = NULL;
    node_t *current = device->nodes;
    
    while (current) {
        node_t *next = current->next;
        node_t *prev = NULL;
        node_t *iter = sorted;
        
        // Find position to insert based on function code and address
        while (iter && (iter->function < current->function || 
               (iter->function == current->function && iter->address < current->address))) {
            prev = iter;
            iter = iter->next;
        }
        
        // Insert node in sorted position
        if (prev) {
            prev->next = current;
        } else {
            sorted = current;
        }
        current->next = iter;
        current = next;
    }
    
    device->nodes = sorted;
    
    // Create groups for consecutive addresses with same function code
    node_group_t *groups = NULL;
    node_group_t *current_group = NULL;
    current = device->nodes;
    
    while (current) {
        if (!current_group || 
            current_group->function != current->function ||
            (current->address - current_group->start_address + get_register_count(current->data_type)) > MODBUS_MAX_REGISTERS) {
            
            // Create new group
            node_group_t *new_group = calloc(1, sizeof(node_group_t));
            if (!new_group) {
                DBG_ERROR("Failed to allocate memory for node group");
                return;
            }
            
            new_group->function = current->function;
            new_group->start_address = current->address;
            new_group->nodes = current;
            
            // Add to groups list
            if (!groups) {
                groups = new_group;
            } else {
                current_group->next = new_group;
            }
            current_group = new_group;
        }
        
        // Calculate offset in group's data buffer
        current->offset = current->address - current_group->start_address;
        
        // Update group's register count
        uint16_t end_address = current->address + get_register_count(current->data_type);
        if (end_address - current_group->start_address > current_group->register_count) {
            current_group->register_count = end_address - current_group->start_address;
        }
        
        current = current->next;
    }
    
    // Allocate data buffers for each group
    current_group = groups;
    while (current_group) {
        current_group->data_buffer = calloc(current_group->register_count, sizeof(uint16_t));
        if (!current_group->data_buffer) {
            DBG_ERROR("Failed to allocate data buffer for node group");
            return;
        }
        current_group = current_group->next;
    }
    
    device->groups = groups;
}

// Convert byte array to hex string and send via websocket
static void send_hex_string(const uint8_t *data, int len) {
    if (!data || len <= 0) return;

    // Each byte needs 4 chars (0x + 2 hex chars) plus 1 space, and 1 null terminator
    char *hex_str = malloc(len * 5 + 1);
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

// Get device configuration from database and parse JSON
device_t* get_device_config(void) {
    device_t *head = NULL;
    device_t *current = NULL;
    char json_str[8*4096] = {0}; // Adjust size as needed

    // Read JSON string from database
    int read_len = db_read("device_config", json_str, sizeof(json_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read device config from database");
        return NULL;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse device config JSON");
        return NULL;
    }

    int device_count = cJSON_GetArraySize(root);
    for (int i = 0; i < device_count; i++) {
        cJSON *device_obj = cJSON_GetArrayItem(root, i);
        
        device_t *new_device = (device_t*)calloc(1, sizeof(device_t));
        if (!new_device) {
            DBG_ERROR("Memory allocation failed for device");
            cJSON_Delete(root);
            return head;
        }

        cJSON *name = cJSON_GetObjectItem(device_obj, "n");
        cJSON *dev_addr = cJSON_GetObjectItem(device_obj, "da");
        cJSON *polling_interval = cJSON_GetObjectItem(device_obj, "pi");
        cJSON *group_mode = cJSON_GetObjectItem(device_obj, "g");
        cJSON *nodes = cJSON_GetObjectItem(device_obj, "ns");

        if (name && name->valuestring) {
            new_device->name = strdup(name->valuestring);
        }
        if (dev_addr) {
            new_device->device_addr = dev_addr->valueint;
        }
        if (polling_interval) {
            new_device->polling_interval = polling_interval->valueint;
        } else {
            new_device->polling_interval = MODBUS_POLLING_INTERVAL;
        }
        if (group_mode) {
            new_device->group_mode = group_mode->valueint != 0;
        } else {
            new_device->group_mode = false;  // Default to basic polling mode
        }
        if (nodes) {
            new_device->nodes = parse_nodes(nodes);
            // Create node groups if group mode is enabled
            if (new_device->group_mode) {
                create_node_groups(new_device);
            }
        }

        if (!head) {
            head = new_device;
            current = head;
        } else {
            current->next = new_device;
            current = new_device;
        }
    }

    cJSON_Delete(root);
    
    // Log the parsed configuration
    device_t *device = head;
    while (device) {
        DBG_INFO("Device: %s (addr: %d, interval: %dms, group mode: %d)", 
                 device->name, device->device_addr, 
                 device->polling_interval, device->group_mode);
        
        node_t *node = device->nodes;
        while (node) {
            DBG_INFO("  Node: %s (addr: %d, func: %d, type: %d, timeout: %dms)",
                     node->name, node->address, node->function,
                     node->data_type, node->timeout);
            node = node->next;
        }
        device = device->next;
    }
    
    return head;
}

// Free entire device configuration linked list
void free_device_config(device_t *config) {
    device_t *current = config;
    while (current) {
        device_t *next = current->next;
        free_device(current);
        current = next;
    }
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
    
    device_t *config = get_device_config();
    if (!config) {
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

    method_ws_log = get_log_method();

    // Run continuously
    while (1) {
        // Poll all devices (each device handles its own polling interval)
        rtu_master_poll(ctx, fd, config);
    }

    exit:
    if(config) {
        free_device_config(config);
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
