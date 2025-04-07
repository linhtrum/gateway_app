#include "query_handle.h"
#include "report.h"
#include "cJSON.h"
#include <string.h>
#include <stdlib.h>

// Static query handle context
static query_handle_ctx_t g_query_ctx = {0};

// Calculate Modbus CRC16
// static uint16_t modbus_crc16(const uint8_t *data, int length) {
//     uint16_t crc = 0xFFFF;
    
//     for (int i = 0; i < length; i++) {
//         crc ^= data[i];
//         for (int j = 0; j < 8; j++) {
//             if (crc & 0x0001) {
//                 crc = (crc >> 1) ^ 0xA001;
//             } else {
//                 crc = crc >> 1;
//             }
//         }
//     }
    
//     return crc;
// }

// Parse JSON protocol message
static bool parse_json_protocol(const char *payload, json_protocol_t *protocol) {
    if (!payload || !protocol) {
        DBG_ERROR("Invalid parameters");
        return false;
    }

    cJSON *root = cJSON_Parse(payload);
    if (!root) {
        DBG_ERROR("Failed to parse JSON payload");
        return false;
    }

    // Get rw_prot object
    cJSON *rw_prot = cJSON_GetObjectItem(root, "rw_prot");
    if (!rw_prot) {
        DBG_ERROR("Missing rw_prot object");
        cJSON_Delete(root);
        return false;
    }

    // Parse and validate version
    cJSON *ver = cJSON_GetObjectItem(rw_prot, "Ver");
    if (!ver || !ver->valuestring || strcmp(ver->valuestring, "2.0.3") != 0) {
        DBG_ERROR("Invalid or missing version");
        cJSON_Delete(root);
        return false;
    }
    strncpy(protocol->ver, ver->valuestring, sizeof(protocol->ver) - 1);

    // Parse and validate direction
    cJSON *dir = cJSON_GetObjectItem(rw_prot, "dir");
    if (!dir || !dir->valuestring || (strcmp(dir->valuestring, "down") != 0)) {
        DBG_ERROR("Invalid or missing direction");
        cJSON_Delete(root);
        return false;
    }
    strncpy(protocol->dir, "up", sizeof(protocol->dir) - 1);

    // Parse ID
    cJSON *id = cJSON_GetObjectItem(rw_prot, "id");
    if (id && id->valuestring) {
        strncpy(protocol->id, id->valuestring, sizeof(protocol->id) - 1);
    }

    // Parse read data points
    cJSON *r_data = cJSON_GetObjectItem(rw_prot, "r_data");
    if (r_data && cJSON_IsArray(r_data)) {
        int count = cJSON_GetArraySize(r_data);
        protocol->r_data_count = (count > MAX_DATA_POINTS) ? MAX_DATA_POINTS : count;
        
        for (int i = 0; i < protocol->r_data_count; i++) {
            cJSON *item = cJSON_GetArrayItem(r_data, i);
            cJSON *name = cJSON_GetObjectItem(item, "name");
            if (name && name->valuestring) {
                strncpy(protocol->r_data[i].name, name->valuestring, sizeof(protocol->r_data[i].name) - 1);
            }
        }
    } else {
        protocol->r_data_count = 0;
    }

    // Parse write data points
    cJSON *w_data = cJSON_GetObjectItem(rw_prot, "w_data");
    if (w_data && cJSON_IsArray(w_data)) {
        int count = cJSON_GetArraySize(w_data);
        protocol->w_data_count = (count > MAX_DATA_POINTS) ? MAX_DATA_POINTS : count;
        
        for (int i = 0; i < protocol->w_data_count; i++) {
            cJSON *item = cJSON_GetArrayItem(w_data, i);
            cJSON *name = cJSON_GetObjectItem(item, "name");
            cJSON *value = cJSON_GetObjectItem(item, "value");
            
            if (name && name->valuestring) {
                strncpy(protocol->w_data[i].name, name->valuestring, sizeof(protocol->w_data[i].name) - 1);
            }
            
            if (value) {
                if (cJSON_IsString(value)) {
                    strncpy(protocol->w_data[i].value, value->valuestring, sizeof(protocol->w_data[i].value) - 1);
                } else if (cJSON_IsNumber(value)) {
                    snprintf(protocol->w_data[i].value, sizeof(protocol->w_data[i].value), "%g", value->valuedouble);
                } else if (cJSON_IsBool(value)) {
                    snprintf(protocol->w_data[i].value, sizeof(protocol->w_data[i].value), "%d", cJSON_IsTrue(value));
                }
            }
        }
    } else {
        protocol->w_data_count = 0;
    }

    cJSON_Delete(root);
    return true;
}

// Create JSON protocol response
static char* create_json_protocol_response(const json_protocol_t *protocol) {
    if (!protocol) {
        DBG_ERROR("Invalid protocol parameter");
        return NULL;
    }

    cJSON *root = cJSON_CreateObject();
    if (!root) {
        DBG_ERROR("Failed to create JSON root");
        return NULL;
    }

    cJSON *rw_prot = cJSON_CreateObject();
    if (!rw_prot) {
        DBG_ERROR("Failed to create rw_prot object");
        cJSON_Delete(root);
        return NULL;
    }

    cJSON_AddItemToObject(root, "rw_prot", rw_prot);

    // Add version
    cJSON_AddStringToObject(rw_prot, "Ver", protocol->ver);

    // Add direction
    cJSON_AddStringToObject(rw_prot, "dir", protocol->dir);

    // Add ID
    cJSON_AddStringToObject(rw_prot, "id", protocol->id);

    // Add read data points
    if (protocol->r_data_count > 0) {
        cJSON *r_data = cJSON_CreateArray();
        if (r_data) {
            cJSON_AddItemToObject(rw_prot, "r_data", r_data);
            
            for (int i = 0; i < protocol->r_data_count; i++) {
                cJSON *item = cJSON_CreateObject();
                if (item) {
                    cJSON_AddItemToArray(r_data, item);
                    cJSON_AddStringToObject(item, "name", protocol->r_data[i].name);
                    cJSON_AddStringToObject(item, "value", protocol->r_data[i].value);
                    cJSON_AddStringToObject(item, "err", protocol->r_data[i].err);
                }
            }
        }
    }

    // Add write data points
    if (protocol->w_data_count > 0) {
        cJSON *w_data = cJSON_CreateArray();
        if (w_data) {
            cJSON_AddItemToObject(rw_prot, "w_data", w_data);
            
            for (int i = 0; i < protocol->w_data_count; i++) {
                cJSON *item = cJSON_CreateObject();
                if (item) {
                    cJSON_AddItemToArray(w_data, item);
                    cJSON_AddStringToObject(item, "name", protocol->w_data[i].name);
                    cJSON_AddStringToObject(item, "value", protocol->w_data[i].value);
                    cJSON_AddStringToObject(item, "err", protocol->w_data[i].err);
                }
            }
        }
    }

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) {
        DBG_ERROR("Failed to convert JSON to string");
        return NULL;
    }

    return json_str;
}

// Process read data points
static void process_read_data_points(json_protocol_t *protocol) {
    if (!protocol) {
        return;
    }

    for (int i = 0; i < protocol->r_data_count; i++) {
        // Find node by name
        node_t *node = NULL;
        device_t *device = device_get_config();
        
        while (device) {
            node_t *current = device->nodes;
            while (current) {
                if (strcmp(current->name, protocol->r_data[i].name) == 0) {
                    node = current;
                    break;
                }
                current = current->next;
            }
            
            if (node) {
                break;
            }
            
            device = device->next;
        }
        
        if (node) {
            // Format value based on data type
            char value_str[64] = {0};
            
            if (node->is_ok) {
                switch (node->data_type) {
                    case DATA_TYPE_BOOLEAN:
                        snprintf(value_str, sizeof(value_str), "%d", node->value.bool_val);
                        break;
                    case DATA_TYPE_INT8:
                        snprintf(value_str, sizeof(value_str), "%d", node->value.int8_val);
                        break;
                    case DATA_TYPE_UINT8:
                        snprintf(value_str, sizeof(value_str), "%u", node->value.uint8_val);
                        break;
                    case DATA_TYPE_INT16:
                        snprintf(value_str, sizeof(value_str), "%d", node->value.int16_val);
                        break;
                    case DATA_TYPE_UINT16:
                        snprintf(value_str, sizeof(value_str), "%u", node->value.uint16_val);
                        break;
                    case DATA_TYPE_INT32_ABCD:
                    case DATA_TYPE_INT32_CDAB:
                        snprintf(value_str, sizeof(value_str), "%ld", node->value.int32_val);
                        break;
                    case DATA_TYPE_UINT32_ABCD:
                    case DATA_TYPE_UINT32_CDAB:
                        snprintf(value_str, sizeof(value_str), "%lu", node->value.uint32_val);
                        break;
                    case DATA_TYPE_FLOAT_ABCD:
                    case DATA_TYPE_FLOAT_CDAB:
                        snprintf(value_str, sizeof(value_str), "%.6f", node->value.float_val);
                        break;
                    case DATA_TYPE_DOUBLE:
                        snprintf(value_str, sizeof(value_str), "%.6f", node->value.double_val);
                        break;
                    default:
                        snprintf(value_str, sizeof(value_str), "0");
                        break;
                }
                
                strncpy(protocol->r_data[i].value, value_str, sizeof(protocol->r_data[i].value) - 1);
                strncpy(protocol->r_data[i].err, "0", sizeof(protocol->r_data[i].err) - 1);
            } else {
                strncpy(protocol->r_data[i].value, "0", sizeof(protocol->r_data[i].value) - 1);
                strncpy(protocol->r_data[i].err, "1", sizeof(protocol->r_data[i].err) - 1);
            }
        } else {
            // Node not found
            strncpy(protocol->r_data[i].value, "0", sizeof(protocol->r_data[i].value) - 1);
            strncpy(protocol->r_data[i].err, "2", sizeof(protocol->r_data[i].err) - 1);
        }
    }
}

// Process write data points
static void process_write_data_points(json_protocol_t *protocol) {
    if (!protocol) {
        return;
    }

    // Initialize Modbus context
    uint8_t master_send_buf[MODBUS_MAX_ADU_LENGTH];
    uint8_t master_recv_buf[MODBUS_MAX_ADU_LENGTH];
    agile_modbus_rtu_t ctx_rtu;
    agile_modbus_tcp_t ctx_tcp;
    agile_modbus_t *ctx = NULL;

    for (int i = 0; i < protocol->w_data_count; i++) {
        // Find node by name
        node_t *node = NULL;
        device_t *device = device_get_config();
        
        while (device) {
            node_t *current = device->nodes;
            while (current) {
                if (strcmp(current->name, protocol->w_data[i].name) == 0) {
                    node = current;
                    break;
                }
                current = current->next;
            }
            
            if (node) {
                break;
            }
            
            device = device->next;
        }
        
        if (node && device) {
            // Check if this is an internal gateway register (port 4)
            if (device->port == 4) {
                // Internal registers are read-only
                strncpy(protocol->w_data[i].err, "10", sizeof(protocol->w_data[i].err) - 1);
                continue;
            }

            // Check if node function code is valid for writing (1, 3, or 4)
            if (node->function != 1 && node->function != 3 && node->function != 4) {
                strncpy(protocol->w_data[i].err, "4", sizeof(protocol->w_data[i].err) - 1);
                continue;
            }

            if (strcmp(node->name, "AI1") == 0 || strcmp(node->name, "AI2") == 0) {
                strncpy(protocol->w_data[i].err, "9", sizeof(protocol->w_data[i].err) - 1);
                continue;
            }

            // Special handling for gateway relay outputs (DO1, DO2)
            if (strcmp(node->name, "DO1") == 0 || strcmp(node->name, "DO2") == 0) {
                // Parse value as boolean
                bool value = (strcmp(protocol->w_data[i].value, "1") == 0 || 
                            strcmp(protocol->w_data[i].value, "true") == 0);
                
                // Send control message to IO control thread
                io_control_msg_t msg = {
                    .type = IO_CONTROL_TYPE_RELAY,
                    .relay = {
                        .index = (strcmp(node->name, "DO1") == 0) ? 0 : 1,
                        .state = value
                    }
                };
                
                if (io_control_send_msg(&msg) == 0) {
                    strncpy(protocol->w_data[i].err, "0", sizeof(protocol->w_data[i].err) - 1);
                } else {
                    strncpy(protocol->w_data[i].err, "9", sizeof(protocol->w_data[i].err) - 1);
                }
                continue;
            }

            // Parse value based on data type
            bool success = false;
            uint16_t write_value[2] = {0};  // For multi-register writes
            uint8_t write_bytes[4] = {0};   // For multi-register writes
            int register_count = 1;         // Default to single register
            
            switch (node->data_type) {
                case DATA_TYPE_BOOLEAN:
                    write_value[0] = (strcmp(protocol->w_data[i].value, "1") == 0 || 
                                    strcmp(protocol->w_data[i].value, "true") == 0) ? 0xFF00 : 0x0000;
                    success = true;
                    break;
                case DATA_TYPE_INT8:
                    write_value[0] = (uint16_t)(int8_t)atoi(protocol->w_data[i].value);
                    success = true;
                    break;
                case DATA_TYPE_UINT8:
                    write_value[0] = (uint16_t)(uint8_t)atoi(protocol->w_data[i].value);
                    success = true;
                    break;
                case DATA_TYPE_INT16:
                    write_value[0] = (uint16_t)(int16_t)atoi(protocol->w_data[i].value);
                    success = true;
                    break;
                case DATA_TYPE_UINT16:
                    write_value[0] = (uint16_t)atoi(protocol->w_data[i].value);
                    success = true;
                    break;
                case DATA_TYPE_INT32_ABCD:
                case DATA_TYPE_UINT32_ABCD:
                case DATA_TYPE_FLOAT_ABCD:
                    {
                        uint32_t value = (uint32_t)atol(protocol->w_data[i].value);
                        write_bytes[0] = (value >> 24) & 0xFF;
                        write_bytes[1] = (value >> 16) & 0xFF;
                        write_bytes[2] = (value >> 8) & 0xFF;
                        write_bytes[3] = value & 0xFF;
                        write_value[0] = (write_bytes[0] << 8) | write_bytes[1];
                        write_value[1] = (write_bytes[2] << 8) | write_bytes[3];
                        register_count = 2;
                        success = true;
                    }
                    break;
                case DATA_TYPE_INT32_CDAB:
                case DATA_TYPE_UINT32_CDAB:
                case DATA_TYPE_FLOAT_CDAB:
                    {
                        uint32_t value = (uint32_t)atol(protocol->w_data[i].value);
                        write_bytes[0] = (value >> 24) & 0xFF;
                        write_bytes[1] = (value >> 16) & 0xFF;
                        write_bytes[2] = (value >> 8) & 0xFF;
                        write_bytes[3] = value & 0xFF;
                        write_value[0] = (write_bytes[2] << 8) | write_bytes[3];
                        write_value[1] = (write_bytes[0] << 8) | write_bytes[1];
                        register_count = 2;
                        success = true;
                    }
                    break;
                case DATA_TYPE_DOUBLE:
                    {
                        double value = atof(protocol->w_data[i].value);
                        uint64_t double_bits = *(uint64_t*)&value;
                        for (int j = 0; j < 4; j++) {
                            write_bytes[j] = (double_bits >> (56 - j * 8)) & 0xFF;
                        }
                        write_value[0] = (write_bytes[0] << 8) | write_bytes[1];
                        write_value[1] = (write_bytes[2] << 8) | write_bytes[3];
                        register_count = 2;
                        success = true;
                    }
                    break;
                default:
                    success = false;
                    break;
            }
            
            if (success) {
                // Get the actual slave address and port based on mapping
                uint8_t actual_port = device->port;

                // Initialize appropriate context based on port
                if (actual_port < 2) { // Serial port (0: serial1, 1: serial2)
                    if (!ctx || ctx != &ctx_rtu._ctx) {
                        agile_modbus_rtu_init(&ctx_rtu, master_send_buf, sizeof(master_send_buf),
                                            master_recv_buf, sizeof(master_recv_buf));
                        ctx = &ctx_rtu._ctx;
                    }
                } else { // TCP port (2: ethernet)
                    if (!ctx || ctx != &ctx_tcp._ctx) {
                        agile_modbus_tcp_init(&ctx_tcp, master_send_buf, sizeof(master_send_buf),
                                            master_recv_buf, sizeof(master_recv_buf));
                        ctx = &ctx_tcp._ctx;
                    }
                }

                // Set slave address
                agile_modbus_set_slave(ctx, device->device_addr);

                // Perform Modbus write operation based on function code
                int ret = -1;
                int send_len = 0;
                int read_len = 0;

                if (actual_port < 2) { // Serial port
                    // Open serial port if not already open
                    serial_config_t *serial_config = serial_get_config(actual_port);
                    if (!serial_config->is_open) {
                        if (serial_open(actual_port) < 0) {
                            strncpy(protocol->w_data[i].err, "5", sizeof(protocol->w_data[i].err) - 1);
                            continue;
                        }
                    }

                    if (register_count == 1) {
                        // Single register write
                        if (node->function == 1) {
                            // Write single coil
                            send_len = agile_modbus_serialize_write_bit(ctx, node->address, write_value[0] == 0xFF00);
                        } else {
                            // Write single register
                            send_len = agile_modbus_serialize_write_register(ctx, node->address, write_value[0]);
                        }
                    } else {
                        // Multiple register write
                        send_len = agile_modbus_serialize_write_registers(ctx, node->address, register_count, write_value);
                    }

                    if (send_len > 0) {
                        // Send request
                        ret = serial_write(actual_port, ctx->send_buf, send_len);
                        if (ret > 0) {
                            // Wait for response
                            read_len = serial_read(actual_port, ctx->read_buf, ctx->read_bufsz, 
                                                node->timeout, 0);
                            if (read_len > 0) {
                                // Verify response
                                if (agile_modbus_check_confirmation(ctx, ctx->read_buf, read_len) == 0) {
                                    node->is_ok = true;
                                    strncpy(protocol->w_data[i].err, "0", sizeof(protocol->w_data[i].err) - 1);
                                } else {
                                    strncpy(protocol->w_data[i].err, "6", sizeof(protocol->w_data[i].err) - 1);
                                }
                            } else {
                                strncpy(protocol->w_data[i].err, "7", sizeof(protocol->w_data[i].err) - 1);
                            }
                        } else {
                            strncpy(protocol->w_data[i].err, "7", sizeof(protocol->w_data[i].err) - 1);
                        }
                    }
                } else { // TCP port
                    // Connect to TCP server if not already connected
                    int fd = tcp_connect(device->server_address, device->server_port);
                    if (fd < 0) {
                        strncpy(protocol->w_data[i].err, "8", sizeof(protocol->w_data[i].err) - 1);
                        continue;
                    }

                    if (register_count == 1) {
                        // Single register write
                        if (node->function == 1) {
                            // Write single coil
                            send_len = agile_modbus_serialize_write_bit(ctx, node->address, write_value[0] == 0xFF00);
                        } else {
                            // Write single register
                            send_len = agile_modbus_serialize_write_register(ctx, node->address, write_value[0]);
                        }
                    } else {
                        // Multiple register write
                        send_len = agile_modbus_serialize_write_registers(ctx, node->address, register_count, write_value);
                    }

                    if (send_len > 0) {
                        // Send request
                        ret = tcp_write(fd, ctx->send_buf, send_len);
                        if (ret > 0) {
                            // Wait for response
                            read_len = tcp_read(fd, ctx->read_buf, ctx->read_bufsz, node->timeout, 0);
                            if (read_len > 0) {
                                // Verify response
                                if (agile_modbus_check_confirmation(ctx, ctx->read_buf, read_len) == 0) {
                                    node->is_ok = true;
                                    strncpy(protocol->w_data[i].err, "0", sizeof(protocol->w_data[i].err) - 1);
                                } else {
                                    strncpy(protocol->w_data[i].err, "6", sizeof(protocol->w_data[i].err) - 1);
                                }
                            } else {
                                strncpy(protocol->w_data[i].err, "7", sizeof(protocol->w_data[i].err) - 1);
                            }
                        } else {
                            strncpy(protocol->w_data[i].err, "7", sizeof(protocol->w_data[i].err) - 1);
                        }
                    }

                    tcp_close(fd);
                }
            } else {
                strncpy(protocol->w_data[i].err, "3", sizeof(protocol->w_data[i].err) - 1);
            }
        } else {
            // Node not found
            strncpy(protocol->w_data[i].err, "2", sizeof(protocol->w_data[i].err) - 1);
        }
    }
}

// Create default error response
static char* create_default_error_response(void) {
    cJSON *root = cJSON_CreateObject();
    if (!root) {
        return NULL;
    }

    cJSON *rw_prot = cJSON_CreateObject();
    if (!rw_prot) {
        cJSON_Delete(root);
        return NULL;
    }

    cJSON_AddItemToObject(root, "rw_prot", rw_prot);
    cJSON_AddStringToObject(rw_prot, "Ver", "2.0.3");
    cJSON_AddStringToObject(rw_prot, "dir", "up");
    cJSON_AddStringToObject(rw_prot, "err", "1");

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_str;
}

// Handle JSON protocol message
static void handle_json_protocol(const char *topic, const char *payload, int payload_len) {
    if (!topic || !payload || payload_len <= 0) {
        DBG_ERROR("Invalid parameters");
        return;
    }

    json_protocol_t protocol = {0};
    
    // Parse JSON protocol
    if (!parse_json_protocol(payload, &protocol)) {
        DBG_ERROR("Failed to parse JSON protocol");
        char *error_response = create_default_error_response();
        if (error_response) {
            // Get report configuration
            report_config_t *config = report_get_config();
            if (config) {
                // Publish error response
                if (mqtt_is_enabled()) {
                    mqtt_publish(config->mqtt_respond_topic, error_response, 
                               config->mqtt_respond_qos, false);
                }
            }
            free(error_response);
        }
        return;
    }
    
    // Process read data points
    if (protocol.r_data_count > 0) {
        process_read_data_points(&protocol);
    }
    if (protocol.w_data_count > 0) {
        process_write_data_points(&protocol);
    }
    
    // Create response
    char *response = create_json_protocol_response(&protocol);
    if (response) {
        // Get report configuration
        report_config_t *config = report_get_config();
        if (config) {
            // Publish response
            if (mqtt_is_enabled()) {
                mqtt_publish(config->mqtt_respond_topic, response, 
                           config->mqtt_respond_qos, false);
            }
        }
        free(response);
    }
}

// Convert Modbus RTU frame to TCP frame
// static int modbus_rtu_to_tcp(const uint8_t *rtu_frame, int rtu_len, uint8_t *tcp_frame, int tcp_bufsz) {
//     if (!rtu_frame || !tcp_frame || rtu_len < 4 || tcp_bufsz < rtu_len + 6) {
//         return -1;
//     }

//     // RTU frame: [slave_addr][function_code][data][crc]
//     // TCP frame: [transaction_id][protocol_id][length][unit_id][function_code][data]
    
//     // Use current time as transaction ID
//     uint16_t transaction_id = (uint16_t)time(NULL);
    
//     // Set TCP frame header
//     tcp_frame[0] = (transaction_id >> 8) & 0xFF;  // Transaction ID high byte
//     tcp_frame[1] = transaction_id & 0xFF;         // Transaction ID low byte
//     tcp_frame[2] = 0x00;                          // Protocol ID high byte (0 for Modbus TCP)
//     tcp_frame[3] = 0x00;                          // Protocol ID low byte (0 for Modbus TCP)
//     tcp_frame[4] = ((rtu_len - 2) >> 8) & 0xFF;  // Length high byte (excluding CRC)
//     tcp_frame[5] = (rtu_len - 2) & 0xFF;         // Length low byte (excluding CRC)
    
//     // Copy RTU frame to TCP frame (excluding CRC)
//     memcpy(&tcp_frame[6], rtu_frame, rtu_len - 2);
    
//     return rtu_len + 4;  // Return total TCP frame length
// }

// Convert Modbus TCP frame to RTU frame
// static int modbus_tcp_to_rtu(const uint8_t *tcp_frame, int tcp_len, uint8_t *rtu_frame, int rtu_bufsz) {
//     if (!tcp_frame || !rtu_frame || tcp_len < 7 || rtu_bufsz < tcp_len - 6) {
//         return -1;
//     }

//     // TCP frame: [transaction_id][protocol_id][length][unit_id][function_code][data]
//     // RTU frame: [slave_addr][function_code][data][crc]
    
//     // Copy TCP frame to RTU frame (excluding header)
//     int rtu_len = tcp_len - 6;
//     memcpy(rtu_frame, &tcp_frame[6], rtu_len);
    
//     // Calculate CRC for RTU frame
//     uint16_t crc = modbus_crc16(rtu_frame, rtu_len);
//     rtu_frame[rtu_len] = crc & 0xFF;
//     rtu_frame[rtu_len + 1] = (crc >> 8) & 0xFF;
    
//     return rtu_len + 2;  // Return total RTU frame length
// }

// Handle Modbus RTU protocol message
// static void handle_modbus_rtu_protocol(const char *topic, const char *payload, int payload_len) {
//     if (!topic || !payload || payload_len <= 0) {
//         DBG_ERROR("Invalid parameters");
//         return;
//     }

//     // Initialize Modbus context
//     uint8_t master_send_buf[MODBUS_MAX_ADU_LENGTH];
//     uint8_t master_recv_buf[MODBUS_MAX_ADU_LENGTH];
//     agile_modbus_rtu_t ctx_rtu;
//     agile_modbus_tcp_t ctx_tcp;
//     agile_modbus_t *ctx = NULL;

//     // Parse the payload as a Modbus RTU frame
//     // The payload should contain: [slave_addr][function_code][data][crc]
//     if (payload_len < 4) { // Minimum length for a valid RTU frame
//         DBG_ERROR("Invalid RTU frame length");
//         return;
//     }

//     // Extract slave address and function code
//     uint8_t slave_addr = payload[0];
//     uint8_t function_code = payload[1];

//     // Find device by mapped slave address
//     device_t *device = device_get_config();
//     while (device) {
//         uint8_t actual_slave_addr = device->enable_mapping ? device->mapped_slave_addr : device->device_addr;
//         if (actual_slave_addr == slave_addr) {
//             break;
//         }
//         device = device->next;
//     }

//     if (!device) {
//         DBG_ERROR("Device not found for slave address %d", slave_addr);
//         return;
//     }

//     // Initialize appropriate context based on port
//     if (device->port <= 2) { // Serial port (0: serial1, 1: serial2)
//         agile_modbus_rtu_init(&ctx_rtu, master_send_buf, sizeof(master_send_buf),
//                             master_recv_buf, sizeof(master_recv_buf));
//         ctx = &ctx_rtu._ctx;
//     } else { // TCP port (2: ethernet)
//         agile_modbus_tcp_init(&ctx_tcp, master_send_buf, sizeof(master_send_buf),
//                             master_recv_buf, sizeof(master_recv_buf));
//         ctx = &ctx_tcp._ctx;
//     }

//     // Set slave address
//     agile_modbus_set_slave(ctx, device->device_addr);

//     // Process the request based on port type
//     int ret = -1;
//     int send_len = payload_len;
//     int read_len = 0;

//     if (device->port <= 2) { // Serial port
//         // Open serial port if not already open
//         serial_config_t *serial_config = serial_get_config(device->port);
//         if (!serial_config->is_open) {
//             if (serial_open(device->port) < 0) {
//                 DBG_ERROR("Failed to open serial port %d", device->port);
//                 return;
//             }
//         }

//         // Send request
//         ret = serial_write(device->port, (uint8_t*)payload, send_len);
//         if (ret > 0) {
//             // Wait for response
//             read_len = serial_read(device->port, ctx->read_buf, ctx->read_bufsz, 
//                                 MODBUS_RTU_TIMEOUT, 0);
//             if (read_len > 0) {
//                 // Verify response
//                 if (agile_modbus_check_confirmation(ctx, ctx->read_buf, read_len) == 0) {
//                     // Send response back to server
//                     report_config_t *config = report_get_config();
//                     if (config && mqtt_is_enabled()) {
//                         mqtt_publish(config->mqtt_respond_topic, (char*)ctx->read_buf, 
//                                    config->mqtt_respond_qos, false);
//                     }
//                 } else {
//                     DBG_ERROR("Invalid RTU response");
//                 }
//             } else {
//                 DBG_ERROR("RTU read timeout");
//             }
//         }
//     } else { // TCP port
//         // Connect to TCP server if not already connected
//         int fd = tcp_connect(device->server_address, device->server_port);
//         if (fd < 0) {
//             DBG_ERROR("Failed to connect to TCP server");
//             return;
//         }

//         // Convert RTU to TCP frame
//         uint8_t tcp_frame[MODBUS_MAX_ADU_LENGTH];
//         int tcp_len = modbus_rtu_to_tcp((uint8_t*)payload, payload_len, tcp_frame, sizeof(tcp_frame));
//         if (tcp_len > 0) {
//             // Send request
//             ret = tcp_write(fd, tcp_frame, tcp_len);
//             if (ret > 0) {
//                 // Wait for response
//                 read_len = tcp_read(fd, ctx->read_buf, ctx->read_bufsz, MODBUS_RTU_TIMEOUT, 0);
//                 if (read_len > 0) {
//                     // Convert TCP to RTU response
//                     uint8_t rtu_response[MODBUS_MAX_ADU_LENGTH];
//                     int rtu_len = modbus_tcp_to_rtu(ctx->read_buf, read_len, rtu_response, sizeof(rtu_response));
//                     if (rtu_len > 0) {
//                         // Send response back to server
//                         report_config_t *config = report_get_config();
//                         if (config && mqtt_is_enabled()) {
//                             mqtt_publish(config->mqtt_respond_topic, (char*)rtu_response, 
//                                        config->mqtt_respond_qos, false);
//                         }
//                     }
//                 } else {
//                     DBG_ERROR("TCP read timeout");
//                 }
//             }
//         }

//         tcp_close(fd);
//     }
// }

// Handle Modbus TCP protocol message
// static void handle_modbus_tcp_protocol(const char *topic, const char *payload, int payload_len) {
//     if (!topic || !payload || payload_len <= 0) {
//         DBG_ERROR("Invalid parameters");
//         return;
//     }

//     // Initialize Modbus context
//     uint8_t master_send_buf[MODBUS_MAX_ADU_LENGTH];
//     uint8_t master_recv_buf[MODBUS_MAX_ADU_LENGTH];
//     agile_modbus_rtu_t ctx_rtu;
//     agile_modbus_tcp_t ctx_tcp;
//     agile_modbus_t *ctx = NULL;

//     // Parse the payload as a Modbus TCP frame
//     // The payload should contain: [transaction_id][protocol_id][length][unit_id][function_code][data]
//     if (payload_len < 7) { // Minimum length for a valid TCP frame
//         DBG_ERROR("Invalid TCP frame length");
//         return;
//     }

//     // Extract unit ID and function code
//     uint8_t unit_id = payload[6];
//     uint8_t function_code = payload[7];

//     // Find device by mapped slave address
//     device_t *device = device_get_config();
//     while (device) {
//         uint8_t actual_slave_addr = device->enable_mapping ? device->mapped_slave_addr : device->device_addr;
//         if (actual_slave_addr == unit_id) {
//             break;
//         }
//         device = device->next;
//     }

//     if (!device) {
//         DBG_ERROR("Device not found for unit ID %d", unit_id);
//         return;
//     }

//     // Initialize appropriate context based on port
//     if (device->port <= 2) { // Serial port (0: serial1, 1: serial2)
//         agile_modbus_rtu_init(&ctx_rtu, master_send_buf, sizeof(master_send_buf),
//                             master_recv_buf, sizeof(master_recv_buf));
//         ctx = &ctx_rtu._ctx;
//     } else { // TCP port (2: ethernet)
//         agile_modbus_tcp_init(&ctx_tcp, master_send_buf, sizeof(master_send_buf),
//                             master_recv_buf, sizeof(master_recv_buf));
//         ctx = &ctx_tcp._ctx;
//     }

//     // Set slave address
//     agile_modbus_set_slave(ctx, device->device_addr);

//     // Process the request based on port type
//     int ret = -1;
//     int send_len = payload_len;
//     int read_len = 0;

//     if (device->port <= 2) { // Serial port
//         // Convert TCP to RTU frame
//         uint8_t rtu_frame[MODBUS_MAX_ADU_LENGTH];
//         int rtu_len = modbus_tcp_to_rtu((uint8_t*)payload, payload_len, rtu_frame, sizeof(rtu_frame));
//         if (rtu_len > 0) {
//             // Open serial port if not already open
//             serial_config_t *serial_config = serial_get_config(device->port);
//             if (!serial_config->is_open) {
//                 if (serial_open(device->port) < 0) {
//                     DBG_ERROR("Failed to open serial port %d", device->port);
//                     return;
//                 }
//             }

//             // Send request
//             ret = serial_write(device->port, rtu_frame, rtu_len);
//             if (ret > 0) {
//                 // Wait for response
//                 read_len = serial_read(device->port, ctx->read_buf, ctx->read_bufsz, 
//                                     MODBUS_RTU_TIMEOUT, 0);
//                 if (read_len > 0) {
//                     // Convert RTU to TCP response
//                     uint8_t tcp_response[MODBUS_MAX_ADU_LENGTH];
//                     int tcp_len = modbus_rtu_to_tcp(ctx->read_buf, read_len, tcp_response, sizeof(tcp_response));
//                     if (tcp_len > 0) {
//                         // Send response back to server
//                         report_config_t *config = report_get_config();
//                         if (config && mqtt_is_enabled()) {
//                             mqtt_publish(config->mqtt_respond_topic, (char*)tcp_response, 
//                                        config->mqtt_respond_qos, false);
//                         }
//                     }
//                 } else {
//                     DBG_ERROR("RTU read timeout");
//                 }
//             }
//         }
//     } else { // TCP port
//         // Connect to TCP server if not already connected
//         int fd = tcp_connect(device->server_address, device->server_port);
//         if (fd < 0) {
//             DBG_ERROR("Failed to connect to TCP server");
//             return;
//         }

//         // Send request
//         ret = tcp_write(fd, (uint8_t*)payload, send_len);
//         if (ret > 0) {
//             // Wait for response
//             read_len = tcp_read(fd, ctx->read_buf, ctx->read_bufsz, MODBUS_RTU_TIMEOUT, 0);
//             if (read_len > 0) {
//                 // Send response back to server
//                 report_config_t *config = report_get_config();
//                 if (config && mqtt_is_enabled()) {
//                     mqtt_publish(config->mqtt_respond_topic, (char*)ctx->read_buf, 
//                                config->mqtt_respond_qos, false);
//                 }
//             } else {
//                 DBG_ERROR("TCP read timeout");
//             }
//         }

//         tcp_close(fd);
//     }
// }

// MQTT message callback
void query_handle_mqtt_message(const char *topic, const char *payload, int payload_len) {
    if (!topic || !payload || payload_len <= 0) {
        DBG_ERROR("Invalid parameters");
        return;
    }

    // Get report configuration
    report_config_t *config = report_get_config();
    if (!config) {
        DBG_ERROR("Failed to get report configuration");
        return;
    }

    // Check if data query set is enabled
    if (!config->mqtt_data_query_set) {
        DBG_INFO("Data query set is disabled");
        return;
    }

    // Check if topic matches query set topic
    if (strcmp(topic, config->mqtt_query_set_topic) != 0) {
        DBG_INFO("Topic does not match query set topic");
        return;
    }

    // Handle message based on query set type
    switch (config->mqtt_query_set_type) {
        case QUERY_SET_TYPE_MODBUS_RTU:
            // handle_modbus_rtu_protocol(topic, payload, payload_len);
            break;
        case QUERY_SET_TYPE_MODBUS_TCP:
            // handle_modbus_tcp_protocol(topic, payload, payload_len);
            break;
        case QUERY_SET_TYPE_JSON:
            handle_json_protocol(topic, payload, payload_len);
            break;
        default:
            DBG_ERROR("Unsupported query set type: %d", config->mqtt_query_set_type);
            break;
    }
}

