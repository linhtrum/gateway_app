#include <fcntl.h>
#include <termios.h>
#include <unistd.h>
#include <pthread.h>
#include <time.h>
#include "rtu_master.h"
#include "agile_modbus.h"
#include "cJSON.h"
#include "tinyexpr.h"
#include "../database/db.h"
#include "../web_server/net.h"
#include "../web_server/websocket.h"
#include "../log/log_output.h"
#include "../system/management.h"

#include "serial.h"
#include "tcp.h"

#define DBG_TAG "RTU_MASTER"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define DEFAULT_PORT "/dev/ttymxc1"
#define DEFAULT_BAUD 115200

static int method_ws_log = 0; 

static char* build_node_json(const char *node_name, node_t *node);

// Global variables for formula calculation
static te_variable *g_formula_vars = NULL;
static int g_formula_var_count = 0;

// Initialize formula variables array
static int init_formula_vars(void) {
    device_t *current_device = device_get_config();
    if (!current_device) {
        DBG_ERROR("Failed to get device configuration for formula");
        return -1;
    }

    // Count total number of nodes
    int var_count = 0;
    device_t *dev = current_device;
    while (dev) {
        node_t *n = dev->nodes;
        while (n) {
            var_count++;
            n = n->next;
        }
        dev = dev->next;
    }

    // Allocate variables array
    g_formula_vars = calloc(var_count + 1, sizeof(te_variable));
    if (!g_formula_vars) {
        DBG_ERROR("Failed to allocate memory for formula variables");
        return -1;
    }

    // Populate variables array with direct node values
    int var_index = 0;
    dev = current_device;
    while (dev) {
        node_t *n = dev->nodes;
        while (n) {
            g_formula_vars[var_index].name = n->name;
            // Store direct pointer to node value based on data type
            switch (n->data_type) {
                case DATA_TYPE_BOOLEAN:
                    g_formula_vars[var_index].address = &n->value.bool_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_INT8:
                    g_formula_vars[var_index].address = &n->value.int8_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_UINT8:
                    g_formula_vars[var_index].address = &n->value.uint8_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_INT16:
                    g_formula_vars[var_index].address = &n->value.int16_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_UINT16:
                    g_formula_vars[var_index].address = &n->value.uint16_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_INT32_ABCD:
                case DATA_TYPE_INT32_CDAB:
                    g_formula_vars[var_index].address = &n->value.int32_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_UINT32_ABCD:
                case DATA_TYPE_UINT32_CDAB:
                    g_formula_vars[var_index].address = &n->value.uint32_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_FLOAT_ABCD:
                case DATA_TYPE_FLOAT_CDAB:
                    g_formula_vars[var_index].address = &n->value.float_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                case DATA_TYPE_DOUBLE:
                    g_formula_vars[var_index].address = &n->value.double_val;
                    g_formula_vars[var_index].type = TE_FUNCTION1;
                    break;
                default:
                    DBG_ERROR("Unsupported data type for node in formula: %s", n->name);
                    g_formula_vars[var_index].address = NULL;
                    g_formula_vars[var_index].type = 0;
                    break;
            }
            g_formula_vars[var_index].context = 0;
            var_index++;
            n = n->next;
        }
        dev = dev->next;
    }
    g_formula_vars[var_count].name = 0;  // Terminate array
    g_formula_var_count = var_count;

    DBG_INFO("Initialized formula variables array with %d nodes", var_count);
    return 0;
}

// Free formula variables array
static void free_formula_vars(void) {
    if (g_formula_vars) {
        free(g_formula_vars);
        g_formula_vars = NULL;
        g_formula_var_count = 0;
    }
}

// Send data to serial or TCP port
static int rtu_master_send(device_t *device, uint8_t *buf, int len){
    int send_len;

    if(device->port < PORT_ETHERNET)
    {
        send_len = serial_write(device->fd, buf, len);
    }
    else if(device->port == PORT_ETHERNET)
    {
        send_len = tcp_write(device->fd, buf, len);
    }
    else
    {
        send_len = -1;
    }
    return send_len;
}

// Receive data from serial or TCP port
static int rtu_master_receive(device_t *device, uint8_t *buf, int len, int timeout, int byte_timeout){
    int read_len = 0;

    if(device->port < PORT_ETHERNET)
    {
        read_len = serial_read(device->fd, buf, len, timeout, byte_timeout);
    }
    else if(device->port == PORT_ETHERNET)
    {
        read_len = tcp_read(device->fd, buf, len, timeout, byte_timeout);
    }
    else
    {
        // read_len = -1;
    }
    return read_len;
}

// Flush receive buffer of serial or TCP port
static void rtu_master_flush_rx(device_t *device){
    if(device->port < PORT_ETHERNET)
    {
        serial_flush_rx(device->fd);
    }
    else if(device->port == PORT_ETHERNET)
    {
        tcp_flush_rx(device->fd);
    }
    else
    {
        // Do nothing
    }
}

// Get node value by node name for formula calculation
static double get_node_value_for_formula(const char *node_name) {
    if (!node_name) {
        DBG_ERROR("Invalid node name for formula calculation");
        return 0.0;
    }

    device_t *current_device = device_get_config();
    if (!current_device) {
        DBG_ERROR("Failed to get device configuration for formula");
        return 0.0;
    }

    while (current_device) {
        node_t *current_node = current_device->nodes;
        while (current_node) {
            if (strcmp(current_node->name, node_name) == 0) {
                // Convert node value to double based on data type
                switch (current_node->data_type) {
                    case DATA_TYPE_BOOLEAN:
                        return (double)current_node->value.bool_val;
                    case DATA_TYPE_INT8:
                        return (double)current_node->value.int8_val;
                    case DATA_TYPE_UINT8:
                        return (double)current_node->value.uint8_val;
                    case DATA_TYPE_INT16:
                        return (double)current_node->value.int16_val;
                    case DATA_TYPE_UINT16:
                        return (double)current_node->value.uint16_val;
                    case DATA_TYPE_INT32_ABCD:
                    case DATA_TYPE_INT32_CDAB:
                        return (double)current_node->value.int32_val;
                    case DATA_TYPE_UINT32_ABCD:
                    case DATA_TYPE_UINT32_CDAB:
                        return (double)current_node->value.uint32_val;
                    case DATA_TYPE_FLOAT_ABCD:
                    case DATA_TYPE_FLOAT_CDAB:
                        return (double)current_node->value.float_val;
                    case DATA_TYPE_DOUBLE:
                        return current_node->value.double_val;
                    default:
                        DBG_ERROR("Unsupported data type for node in formula: %s", node_name);
                        return 0.0;
                }
            }
            current_node = current_node->next;
        }
        current_device = current_device->next;
    }

    DBG_ERROR("Node not found for formula calculation: %s", node_name);
    return 0.0;
}

// Convert raw data to appropriate data type and store in node
static int convert_node_value(node_t *node, uint16_t *data) {
    if (!node || !data) return RTU_MASTER_INVALID;

    // Store previous value before updating
    node->previous_value = node->value;

    // Convert raw data to appropriate data type
    switch (node->data_type) {
        case DATA_TYPE_BOOLEAN:
            if (node->function == FUNCTION_CODE_READ_COILS || node->function == FUNCTION_CODE_READ_DISCRETE_INPUTS) {
                node->value.bool_val = (((uint8_t *)data)[0] != 0);
            } else {
                node->value.bool_val = (data[0] != 0);
            }
            break;
        case DATA_TYPE_INT8:
            node->value.int8_val = (int8_t)data[0];
            break;
        case DATA_TYPE_UINT8:
            node->value.uint8_val = (uint8_t)data[0];
            break;
        case DATA_TYPE_INT16:
            node->value.int16_val = (int16_t)data[0];
            break;
        case DATA_TYPE_UINT16:
            node->value.uint16_val = data[0];
            break;
        case DATA_TYPE_INT32_ABCD:
            node->value.int32_val = (int32_t)((data[0] << 16) | data[1]);
            break;
        case DATA_TYPE_INT32_CDAB:
            node->value.int32_val = (int32_t)((data[1] << 16) | data[0]);
            break;
        case DATA_TYPE_UINT32_ABCD:
            node->value.uint32_val = (uint32_t)((data[0] << 16) | data[1]);
            break;
        case DATA_TYPE_UINT32_CDAB:
            node->value.uint32_val = (uint32_t)((data[1] << 16) | data[0]);
            break;
        case DATA_TYPE_FLOAT_ABCD:
            memcpy(&node->value.float_val, data, sizeof(float));
            break;
        case DATA_TYPE_FLOAT_CDAB:
            {
                uint16_t temp[2] = {data[1], data[0]};
                memcpy(&node->value.float_val, temp, sizeof(float));
            }
            break;
        case DATA_TYPE_DOUBLE:
            {
                uint16_t temp[4] = {data[0], data[1], data[2], data[3]};
                memcpy(&node->value.double_val, temp, sizeof(double));
            }
            break;
        default:
            DBG_ERROR("Unsupported data type: %d", node->data_type);
            return RTU_MASTER_INVALID;
    }

    // Apply formula if exists
    if (node->formula && g_formula_vars) {
        // Compile and evaluate formula
        te_expr *expr = te_compile(node->formula, g_formula_vars, 0, 0);
        if (expr) {
            double result = te_eval(expr);
            te_free(expr);

            // Store the result back in the appropriate value field
            switch (node->data_type) {
                case DATA_TYPE_BOOLEAN:
                    node->value.bool_val = (result != 0);
                    break;
                case DATA_TYPE_INT8:
                    node->value.int8_val = (int8_t)result;
                    break;
                case DATA_TYPE_UINT8:
                    node->value.uint8_val = (uint8_t)result;
                    break;
                case DATA_TYPE_INT16:
                    node->value.int16_val = (int16_t)result;
                    break;
                case DATA_TYPE_UINT16:
                    node->value.uint16_val = (uint16_t)result;
                    break;
                case DATA_TYPE_INT32_ABCD:
                case DATA_TYPE_INT32_CDAB:
                    node->value.int32_val = (int32_t)result;
                    break;
                case DATA_TYPE_UINT32_ABCD:
                case DATA_TYPE_UINT32_CDAB:
                    node->value.uint32_val = (uint32_t)result;
                    break;
                case DATA_TYPE_FLOAT_ABCD:
                case DATA_TYPE_FLOAT_CDAB:
                    node->value.float_val = (float)result;
                    break;
                case DATA_TYPE_DOUBLE:
                    node->value.double_val = result;
                    break;
            }
            DBG_INFO("Applied formula '%s' to node %s, result: %f", 
                     node->formula, node->name, result);
        } else {
            DBG_ERROR("Failed to compile formula '%s' for node %s", 
                     node->formula, node->name);
        }
    }

    // Check if reporting is enabled and compare values
    if (node->enable_reporting) {
        bool should_report = false;
        double abs_diff = 0.0;

        // Calculate absolute difference based on data type
        switch (node->data_type) {
            case DATA_TYPE_BOOLEAN:
                should_report = node->value.bool_val != node->previous_value.bool_val;
                break;
            case DATA_TYPE_INT8:
                abs_diff = fabs((double)(node->value.int8_val - node->previous_value.int8_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_UINT8:
                abs_diff = fabs((double)(node->value.uint8_val - node->previous_value.uint8_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_INT16:
                abs_diff = fabs((double)(node->value.int16_val - node->previous_value.int16_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_UINT16:
                abs_diff = fabs((double)(node->value.uint16_val - node->previous_value.uint16_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_INT32_ABCD:
            case DATA_TYPE_INT32_CDAB:
                abs_diff = fabs((double)(node->value.int32_val - node->previous_value.int32_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_UINT32_ABCD:
            case DATA_TYPE_UINT32_CDAB:
                abs_diff = fabs((double)(node->value.uint32_val - node->previous_value.uint32_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_FLOAT_ABCD:
            case DATA_TYPE_FLOAT_CDAB:
                abs_diff = fabs((double)(node->value.float_val - node->previous_value.float_val));
                should_report = abs_diff >= node->variation_range;
                break;
            case DATA_TYPE_DOUBLE:
                abs_diff = fabs(node->value.double_val - node->previous_value.double_val);
                should_report = abs_diff >= node->variation_range;
                break;
        }

        // If value change exceeds variation range, send report event
        // if (should_report) {
        //     // Create report event
        //     report_event_t event = {
        //         .node_name = node->name,
        //         .data_type = node->data_type,
        //         .value = node->value,
        //         .previous_value = node->previous_value,
        //         .timestamp = get_current_time_ms()
        //     };

        //     // Send event to report thread
        //     if (send_report_event(&event) != 0) {
        //         DBG_ERROR("Failed to send report event for node %s", node->name);
        //     } else {
        //         DBG_INFO("Sent report event for node %s (diff: %.2f)", node->name, abs_diff);
        //     }
        // }
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
static int poll_single_node(agile_modbus_t *ctx, device_t *device, node_t *node) {
    if (!ctx || !device || !node) return RTU_MASTER_INVALID;

    uint16_t data[4] = {0};  // Buffer for all data types
    int rc;
    int reg_count = get_register_count(node->data_type);
    
    // Send Modbus request based on function code
    switch(node->function) {
        case FUNCTION_CODE_READ_COILS: // Read coils
            rc = agile_modbus_serialize_read_bits(ctx, node->address, reg_count);
            break;
        case FUNCTION_CODE_READ_DISCRETE_INPUTS: // Read discrete inputs
            rc = agile_modbus_serialize_read_input_bits(ctx, node->address, reg_count);
            break;
        case FUNCTION_CODE_READ_HOLDING_REGISTERS: // Read holding registers
            rc = agile_modbus_serialize_read_registers(ctx, node->address, reg_count);
            break;
        case FUNCTION_CODE_READ_INPUT_REGISTERS: // Read input registers
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
    rtu_master_flush_rx(device);
    int send_len = rtu_master_send(device, ctx->send_buf, rc);
    if (send_len != rc) {
        DBG_ERROR("Failed to send request for node %s", node->name);
        return RTU_MASTER_ERROR;
    }

    // Read response with node-specific timeout
    int read_len = rtu_master_receive(device, ctx->read_buf, ctx->read_bufsz, node->timeout, 10);
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
            case FUNCTION_CODE_READ_COILS: // Read coils
                rc = agile_modbus_deserialize_read_bits(ctx, read_len, (uint8_t *)data);
                break;
            case FUNCTION_CODE_READ_DISCRETE_INPUTS: // Read discrete inputs
                rc = agile_modbus_deserialize_read_input_bits(ctx, read_len, (uint8_t *)data);
                break;
            case FUNCTION_CODE_READ_HOLDING_REGISTERS: // Read holding registers
                rc = agile_modbus_deserialize_read_registers(ctx, read_len, data);
                break;
            case FUNCTION_CODE_READ_INPUT_REGISTERS: // Read input registers
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
static int poll_group_node(agile_modbus_t *ctx, device_t *device, node_group_t *group) {
    if (!ctx || !device || !group) return RTU_MASTER_INVALID;

    int rc;
    
    // Send Modbus request based on function code
    switch(group->function) {
        case FUNCTION_CODE_READ_COILS: // Read coils
            rc = agile_modbus_serialize_read_bits(ctx, group->start_address, 
                                                group->register_count);
            break;
        case FUNCTION_CODE_READ_DISCRETE_INPUTS: // Read discrete inputs
            rc = agile_modbus_serialize_read_input_bits(ctx, group->start_address, 
                                                      group->register_count);
            break;
        case FUNCTION_CODE_READ_HOLDING_REGISTERS: // Read holding registers
            rc = agile_modbus_serialize_read_registers(ctx, group->start_address, 
                                                     group->register_count);
            break;
        case FUNCTION_CODE_READ_INPUT_REGISTERS: // Read input registers
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
    rtu_master_flush_rx(device);
    int send_len = rtu_master_send(device, ctx->send_buf, rc);
    if (send_len != rc) {
        DBG_ERROR("Failed to send request for group (function: %d, start: %d)",
                 group->function, group->start_address);
        return RTU_MASTER_ERROR;
    }

    // Read response
    int read_len = rtu_master_receive(device, ctx->read_buf, ctx->read_bufsz, MODBUS_RTU_TIMEOUT, 10);
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
            case FUNCTION_CODE_READ_COILS: // Read coils
                rc = agile_modbus_deserialize_read_bits(ctx, read_len, (uint8_t *)group->data_buffer);
                break;
            case FUNCTION_CODE_READ_DISCRETE_INPUTS: // Read discrete inputs
                rc = agile_modbus_deserialize_read_input_bits(ctx, read_len, (uint8_t *)group->data_buffer);
                break;
            case FUNCTION_CODE_READ_HOLDING_REGISTERS: // Read holding registers
                rc = agile_modbus_deserialize_read_registers(ctx, read_len, group->data_buffer);
                break;
            case FUNCTION_CODE_READ_INPUT_REGISTERS: // Read input registers
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
            if (node->function == FUNCTION_CODE_READ_COILS || node->function == FUNCTION_CODE_READ_DISCRETE_INPUTS) {
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
                node->is_ok = false;
                return convert_result;
            }
            else {
                node->is_ok = true;
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
    cJSON_AddStringToObject(root, "name", node_name);

    // Add value based on data type
    switch (node->data_type) {
        case DATA_TYPE_BOOLEAN:
            cJSON_AddBoolToObject(root, "value", node->value.bool_val);
            break;
        case DATA_TYPE_INT8:
            cJSON_AddNumberToObject(root, "value", node->value.int8_val);
            break;
        case DATA_TYPE_UINT8:
            cJSON_AddNumberToObject(root, "value", node->value.uint8_val);
            break;
        case DATA_TYPE_INT16:
            cJSON_AddNumberToObject(root, "value", node->value.int16_val);
            break;
        case DATA_TYPE_UINT16:
            cJSON_AddNumberToObject(root, "value", node->value.uint16_val);
            break;
        case DATA_TYPE_INT32_ABCD:
        case DATA_TYPE_INT32_CDAB:
            cJSON_AddNumberToObject(root, "value", node->value.int32_val);
            break;
        case DATA_TYPE_UINT32_ABCD:
        case DATA_TYPE_UINT32_CDAB:
            cJSON_AddNumberToObject(root, "value", node->value.uint32_val);
            break;
        case DATA_TYPE_FLOAT_ABCD:
        case DATA_TYPE_FLOAT_CDAB:
            cJSON_AddNumberToObject(root, "value", node->value.float_val);
            break;
        case DATA_TYPE_DOUBLE:
            cJSON_AddNumberToObject(root, "value", node->value.double_val);
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

void rtu_master_poll(agile_modbus_t *ctx, device_t *current_device) {
    if (!current_device || current_device->fd < 0 || !ctx) {
        DBG_ERROR("Invalid parameters for polling");
        return;
    }

    DBG_INFO("Polling device: %s (interval: %dms, mode: %s)", 
                current_device->name, 
                current_device->polling_interval,
                current_device->group_mode ? "group" : "basic");
    
    agile_modbus_set_slave(ctx, current_device->device_addr);
    
    if (current_device->group_mode) {
        // Poll each group
        node_group_t *current_group = current_device->groups;
        while (current_group) {
            int result = poll_group_node(ctx, current_device, current_group);
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
            int result = poll_single_node(ctx, current_device, current_node);
            if (result != RTU_MASTER_OK) {
                DBG_ERROR("Failed to poll node %s (error: %d)", 
                            current_node->name, result);
                current_node->is_ok = false;
            }
            else {
                current_node->is_ok = true;
            }
            // Sleep after each node poll
            usleep(current_device->polling_interval * 1000);
            current_node = current_node->next;
        }
    }
}

// Process virtual registers (port 4) - calculate formula values without polling
static void process_virtual_registers(device_t *device) {
    if (!device) {
        DBG_ERROR("Invalid device for virtual register processing");
        return;
    }

    DBG_INFO("Processing virtual registers for device: %s", device->name);
    
    node_t *current_node = device->nodes;
    while (current_node) {
        if (current_node->formula && g_formula_vars) {
            // Store previous value before updating
            current_node->previous_value = current_node->value;
            
            // Compile and evaluate formula
            te_expr *expr = te_compile(current_node->formula, g_formula_vars, 0, 0);
            if (expr) {
                double result = te_eval(expr);
                te_free(expr);

                // Store the result in the appropriate value field
                switch (current_node->data_type) {
                    case DATA_TYPE_BOOLEAN:
                        current_node->value.bool_val = (result != 0);
                        break;
                    case DATA_TYPE_INT8:
                        current_node->value.int8_val = (int8_t)result;
                        break;
                    case DATA_TYPE_UINT8:
                        current_node->value.uint8_val = (uint8_t)result;
                        break;
                    case DATA_TYPE_INT16:
                        current_node->value.int16_val = (int16_t)result;
                        break;
                    case DATA_TYPE_UINT16:
                        current_node->value.uint16_val = (uint16_t)result;
                        break;
                    case DATA_TYPE_INT32_ABCD:
                    case DATA_TYPE_INT32_CDAB:
                        current_node->value.int32_val = (int32_t)result;
                        break;
                    case DATA_TYPE_UINT32_ABCD:
                    case DATA_TYPE_UINT32_CDAB:
                        current_node->value.uint32_val = (uint32_t)result;
                        break;
                    case DATA_TYPE_FLOAT_ABCD:
                    case DATA_TYPE_FLOAT_CDAB:
                        current_node->value.float_val = (float)result;
                        break;
                    case DATA_TYPE_DOUBLE:
                        current_node->value.double_val = result;
                        break;
                }

                // Check if reporting is enabled and compare values
                if (current_node->enable_reporting) {
                    bool should_report = false;
                    double abs_diff = 0.0;

                    // Calculate absolute difference based on data type
                    switch (current_node->data_type) {
                        case DATA_TYPE_BOOLEAN:
                            should_report = current_node->value.bool_val != current_node->previous_value.bool_val;
                            break;
                        case DATA_TYPE_INT8:
                            abs_diff = fabs((double)(current_node->value.int8_val - current_node->previous_value.int8_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_UINT8:
                            abs_diff = fabs((double)(current_node->value.uint8_val - current_node->previous_value.uint8_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_INT16:
                            abs_diff = fabs((double)(current_node->value.int16_val - current_node->previous_value.int16_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_UINT16:
                            abs_diff = fabs((double)(current_node->value.uint16_val - current_node->previous_value.uint16_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_INT32_ABCD:
                        case DATA_TYPE_INT32_CDAB:
                            abs_diff = fabs((double)(current_node->value.int32_val - current_node->previous_value.int32_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_UINT32_ABCD:
                        case DATA_TYPE_UINT32_CDAB:
                            abs_diff = fabs((double)(current_node->value.uint32_val - current_node->previous_value.uint32_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_FLOAT_ABCD:
                        case DATA_TYPE_FLOAT_CDAB:
                            abs_diff = fabs((double)(current_node->value.float_val - current_node->previous_value.float_val));
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                        case DATA_TYPE_DOUBLE:
                            abs_diff = fabs(current_node->value.double_val - current_node->previous_value.double_val);
                            should_report = abs_diff >= current_node->variation_range;
                            break;
                    }

                    // If value change exceeds variation range, send report event
                    // if (should_report) {
                    //     report_event_t event = {
                    //         .node_name = current_node->name,
                    //         .data_type = current_node->data_type,
                    //         .value = current_node->value,
                    //         .previous_value = current_node->previous_value,
                    //         .timestamp = get_current_time_ms()
                    //     };

                    //     if (send_report_event(&event) != 0) {
                    //         DBG_ERROR("Failed to send report event for virtual node %s", current_node->name);
                    //     } else {
                    //         DBG_INFO("Sent report event for virtual node %s (diff: %.2f)", current_node->name, abs_diff);
                    //     }
                    // }
                }

                // Log the calculated value
                switch (current_node->data_type) {
                    case DATA_TYPE_BOOLEAN:
                        DBG_INFO("Virtual node %s.%s = %d", device->name, current_node->name, current_node->value.bool_val);
                        break;
                    case DATA_TYPE_INT8:
                        DBG_INFO("Virtual node %s.%s = %d", device->name, current_node->name, current_node->value.int8_val);
                        break;
                    case DATA_TYPE_UINT8:
                        DBG_INFO("Virtual node %s.%s = %u", device->name, current_node->name, current_node->value.uint8_val);
                        break;
                    case DATA_TYPE_INT16:
                        DBG_INFO("Virtual node %s.%s = %d", device->name, current_node->name, current_node->value.int16_val);
                        break;
                    case DATA_TYPE_UINT16:
                        DBG_INFO("Virtual node %s.%s = %u", device->name, current_node->name, current_node->value.uint16_val);
                        break;
                    case DATA_TYPE_INT32_ABCD:
                    case DATA_TYPE_INT32_CDAB:
                        DBG_INFO("Virtual node %s.%s = %ld", device->name, current_node->name, current_node->value.int32_val);
                        break;
                    case DATA_TYPE_UINT32_ABCD:
                    case DATA_TYPE_UINT32_CDAB:
                        DBG_INFO("Virtual node %s.%s = %lu", device->name, current_node->name, current_node->value.uint32_val);
                        break;
                    case DATA_TYPE_FLOAT_ABCD:
                    case DATA_TYPE_FLOAT_CDAB:
                        DBG_INFO("Virtual node %s.%s = %.6f", device->name, current_node->name, current_node->value.float_val);
                        break;
                    case DATA_TYPE_DOUBLE:
                        DBG_INFO("Virtual node %s.%s = %.12lf", device->name, current_node->name, current_node->value.double_val);
                        break;
                }

                // Send websocket update
                char *json_msg = build_node_json(current_node->name, current_node);
                if (json_msg) {
                    send_websocket_message(json_msg);
                    free(json_msg);
                }
            } else {
                DBG_ERROR("Failed to compile formula '%s' for virtual node %s", 
                         current_node->formula, current_node->name);
            }
        }
        // Sleep for the device's polling interval
        usleep(device->polling_interval * 1000);
        current_node = current_node->next;
    }
}

static void *rtu_master_thread(void *arg) {
    uint8_t master_send_buf[MODBUS_MAX_ADU_LENGTH];
    uint8_t master_recv_buf[MODBUS_MAX_ADU_LENGTH];

    agile_modbus_rtu_t ctx_rtu;
    agile_modbus_tcp_t ctx_tcp;
    agile_modbus_t *ctx = NULL;
    int tcp_fd = -1;
    int serial_fd = -1;

    device_t *device_config = device_get_config();
    if (!device_config) {
        DBG_ERROR("Invalid configuration for RTU master thread");
        goto exit;
    }

    // Initialize formula variables array
    if (init_formula_vars() != 0) {
        DBG_ERROR("Failed to initialize formula variables");
        goto exit;
    }

    DBG_INFO("RTU master polling thread started");
    method_ws_log = management_get_log_method();

    // Run continuously
    while (1) {
        device_t *current_device = device_config;
        while (current_device) {
            // Initialize appropriate context based on port
            if (current_device->port < PORT_ETHERNET) {
                // RTU mode for ports 0 and 1
                if (!ctx || ctx != &ctx_rtu._ctx) {
                    agile_modbus_rtu_init(&ctx_rtu, master_send_buf, sizeof(master_send_buf),
                                        master_recv_buf, sizeof(master_recv_buf));
                    ctx = &ctx_rtu._ctx;
                }

                if(current_device->fd < 0) {
                    serial_config_t *serial = serial_get_config(current_device->port);
                    if (!serial) {
                        DBG_ERROR("Failed to get serial configuration for port %d", current_device->port);
                        current_device = current_device->next;
                        continue;
                    }

                    if (!serial->is_open) {
                        serial_open(current_device->port);
                    }
                    
                    if (serial->fd < 0) {
                        DBG_ERROR("Failed to open serial port %d", current_device->port);
                        current_device = current_device->next;
                        continue;
                    }

                    current_device->fd = serial->fd;
                }
                rtu_master_poll(ctx, current_device);
            } else if (current_device->port == PORT_ETHERNET) {
                // TCP mode for port 2
                if (!ctx || ctx != &ctx_tcp._ctx) {
                    agile_modbus_tcp_init(&ctx_tcp, master_send_buf, sizeof(master_send_buf),
                                        master_recv_buf, sizeof(master_recv_buf));
                    ctx = &ctx_tcp._ctx;
                }

                // Connect to TCP server if not already connected
                if (current_device->fd < 0) {
                    tcp_fd = tcp_connect(current_device->server_address, current_device->server_port);
                    if (tcp_fd < 0) {
                        DBG_ERROR("Failed to connect to TCP server %s:%d", current_device->server_address, current_device->server_port);
                        current_device = current_device->next;
                        continue;
                    }

                    current_device->fd = tcp_fd;
                }

                // Poll device using TCP context
                rtu_master_poll(ctx, current_device);
            } else if (current_device->port == PORT_VIRTUAL) {
                // Virtual register mode - calculate formula values without polling
                process_virtual_registers(current_device);
            } else if (current_device->port == PORT_IO) {
                // IO mode - read and write IO ports
                // process_io_ports(current_device);
            } else {
                DBG_ERROR("Invalid port number: %d", current_device->port);
            }

            current_device = current_device->next;
        }
    }

exit:
    if (device_config) {
        free_device_config(device_config);
    }

    if (serial_fd >= 0) {
        serial_close(serial_fd);
    }

    if (tcp_fd >= 0) {
        close(tcp_fd);
    }

    // Free formula variables array
    free_formula_vars();

    return NULL;
}

void start_rtu_master_thread(void) {
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
