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

bool device_save_config_from_json(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }
    
    bool success = (db_write("device_config", json_str, strlen(json_str) + 1) == 0);
    return success;
}

// Get device configuration from database and parse JSON
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

// Convert device configuration to JSON string
char *device_config_to_json(void) {
    cJSON *root = cJSON_CreateArray();
    if (!root) {
        DBG_ERROR("Failed to create JSON array");
        return NULL;
    }

    device_t *device = g_device_data;
    while (device) {
        cJSON *device_obj = cJSON_CreateObject();
        if (!device_obj) {
            DBG_ERROR("Failed to create device JSON object");
            cJSON_Delete(root);
            return NULL;
        }

        // Add device properties
        cJSON_AddStringToObject(device_obj, "n", device->name);
        cJSON_AddNumberToObject(device_obj, "da", device->device_addr);
        cJSON_AddNumberToObject(device_obj, "pi", device->polling_interval);
        cJSON_AddBoolToObject(device_obj, "g", device->group_mode);

        // Create nodes array
        cJSON *nodes_array = cJSON_CreateArray();
        if (!nodes_array) {
            DBG_ERROR("Failed to create nodes array");
            cJSON_Delete(device_obj);
            cJSON_Delete(root);
            return NULL;
        }

        // Add each node
        node_t *node = device->nodes;
        while (node) {
            cJSON *node_obj = cJSON_CreateObject();
            if (!node_obj) {
                DBG_ERROR("Failed to create node JSON object");
                cJSON_Delete(nodes_array);
                cJSON_Delete(device_obj);
                cJSON_Delete(root);
                return NULL;
            }

            cJSON_AddStringToObject(node_obj, "n", node->name);
            cJSON_AddNumberToObject(node_obj, "a", node->address);
            cJSON_AddNumberToObject(node_obj, "f", node->function);
            cJSON_AddNumberToObject(node_obj, "dt", node->data_type);
            cJSON_AddNumberToObject(node_obj, "t", node->timeout);

            cJSON_AddItemToArray(nodes_array, node_obj);
            node = node->next;
        }

        cJSON_AddItemToObject(device_obj, "ns", nodes_array);
        cJSON_AddItemToArray(root, device_obj);
        device = device->next;
    }

    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) {
        DBG_ERROR("Failed to convert device config to JSON string");
        return NULL;
    }

    return json_str;
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