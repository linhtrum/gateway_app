#include "device.h"
#include "cJSON.h"
#include "db.h"
#include "../log/log_output.h"

#define DBG_TAG "DEVICE"
#define DBG_LVL LOG_INFO
#include "dbg.h"

static device_t *g_device_data = NULL;

static void free_device_groups(device_t *device);

// Free memory for a node and its members
static void free_node(node_t *node) {
    if (!node) return;
    free(node->name);
    free(node->formula);
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
    free(device->server_address);
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
        cJSON *func = cJSON_GetObjectItem(node_obj, "fc");
        cJSON *data_type = cJSON_GetObjectItem(node_obj, "dt");
        cJSON *timeout = cJSON_GetObjectItem(node_obj, "t");
        cJSON *enable_report = cJSON_GetObjectItem(node_obj, "er");
        cJSON *var_range = cJSON_GetObjectItem(node_obj, "vr");
        cJSON *enable_map = cJSON_GetObjectItem(node_obj, "em");
        cJSON *mapped_addr = cJSON_GetObjectItem(node_obj, "ma");
        cJSON *formula = cJSON_GetObjectItem(node_obj, "fo");

        if (name && name->valuestring) {
            new_node->name = strdup(name->valuestring);
        }
        if (addr) {
            new_node->address = addr->valueint;
        }
        if (func) {
            new_node->function = (function_code_t)func->valueint;
        }
        if (data_type) {
            new_node->data_type = (data_type_t)data_type->valueint;
        }
        if (timeout) {
            new_node->timeout = timeout->valueint;
        } else {
            new_node->timeout = MODBUS_RTU_TIMEOUT; // Default timeout of 1 second
        }
        if (enable_report) {
            new_node->enable_reporting = cJSON_IsTrue(enable_report);
        } else {
            new_node->enable_reporting = false;
        }
        if (var_range) {
            new_node->variation_range = var_range->valueint;
        } else {
            new_node->variation_range = 0; // Default to no variation range
        }
        if (enable_map) {
            new_node->enable_mapping = cJSON_IsTrue(enable_map);
        } else {
            new_node->enable_mapping = false;
        }
        if (mapped_addr) {
            new_node->mapped_address = mapped_addr->valueint;
        } else {
            new_node->mapped_address = new_node->address; // Default to original address
        }
        if (formula && formula->valuestring) {
            new_node->formula = strdup(formula->valuestring);
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
int get_register_count(data_type_t data_type) {
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

// Parse device configuration from JSON
device_t* load_device_config(void) {
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
        cJSON *port = cJSON_GetObjectItem(device_obj, "p");
        cJSON *protocol = cJSON_GetObjectItem(device_obj, "pr");
        cJSON *server_addr = cJSON_GetObjectItem(device_obj, "sa");
        cJSON *server_port = cJSON_GetObjectItem(device_obj, "sp");
        cJSON *enable_map = cJSON_GetObjectItem(device_obj, "em");
        cJSON *mapped_addr = cJSON_GetObjectItem(device_obj, "ma");

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
        if (port) {
            new_device->port = (port_type_t)port->valueint;
        }
        if (protocol) {
            new_device->protocol = (protocol_t)protocol->valueint;
        } else {
            new_device->protocol = PROTOCOL_MODBUS; // Default to RTU
        }
        if (server_addr && server_addr->valuestring) {
            new_device->server_address = strdup(server_addr->valuestring);
        }
        if (server_port) {
            new_device->server_port = server_port->valueint;
        }
        if (enable_map) {
            new_device->enable_mapping = cJSON_IsTrue(enable_map);
        } else {
            new_device->enable_mapping = false;
        }
        if (mapped_addr) {
            new_device->mapped_slave_addr = mapped_addr->valueint;
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
        DBG_INFO("Device: %s (addr: %d, interval: %dms, group mode: %d, port: %d, protocol: %d)", 
                 device->name, device->device_addr, 
                 device->polling_interval, device->group_mode,
                 device->port, device->protocol);
        
        if (device->port == 3) {
            DBG_INFO("  TCP Settings: %s:%d", device->server_address ? device->server_address : "not set", 
                     device->server_port);
        }
        
        if (device->enable_mapping) {
            DBG_INFO("  Address Mapping: %d -> %d", device->device_addr, device->mapped_slave_addr);
        }
        
        node_t *node = device->nodes;
        while (node) {
            DBG_INFO("  Node: %s (addr: %d, func: %d, type: %d, timeout: %dms)",
                     node->name, node->address, node->function,
                     node->data_type, node->timeout);
            
            if (node->enable_reporting) {
                DBG_INFO("    Reporting: enabled, variation range: %d", node->variation_range);
            }
            
            if (node->enable_mapping) {
                DBG_INFO("    Address Mapping: %d -> %d", node->address, node->mapped_address);
            }
            
            if (node->formula) {
                DBG_INFO("    Formula: %s", node->formula);
            }
            
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

void device_init(void) {
    device_t *config = load_device_config();    
    if (config) {
        g_device_data = config;
    } else {
        DBG_ERROR("Failed to load device config");
    }
}

device_t* device_get_config(void) {
    return g_device_data;
}