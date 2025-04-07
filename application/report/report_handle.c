#include "report_hanlle.h"
#include "report.h"
#include "../database/db.h"
#include "cJSON.h"
#include <string.h>
#include <time.h>

#define DBG_TAG "REPORT_HANDLE"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define REPORT_QUEUE_SIZE 1000
#define MAX_JSON_SIZE 4096
#define MAX_NODES 300  // Maximum number of unique nodes to track

// System value names
#define SYS_SN "sys_sn"
#define SYS_MAC "sys_mac"
#define SYS_IMEI "sys_imei"
#define SYS_ICCID "sys_iccid"
#define SYS_TIME "sys_time"
#define SYS_UNIX_TIME "sys_unix_time"

// Node value lookup table structure
typedef struct {
    char *node_name;
    node_value_t *value;
    node_value_t *previous_value;  // Previous value for reporting comparison
    data_type_t data_type;
    bool is_ok;                   // Node status (true = valid, false = invalid)
    uint8_t read_status;          // Read status (0 = success, 1 = timeout, 2 = error)
    bool enable_reporting;        // Enable reporting on change
    uint16_t variation_range;     // Variation range for reporting
} node_lookup_t;

static report_handle_ctx_t g_report_ctx = {0};
static node_lookup_t g_node_lookup[MAX_NODES] = {0};
static int g_node_lookup_count = 0;

// Initialize report event queue
static int init_report_queue(report_queue_t *queue) {
    queue->events = calloc(REPORT_QUEUE_SIZE, sizeof(report_event_t));
    if (!queue->events) {
        DBG_ERROR("Failed to allocate memory for report queue");
        return -1;
    }

    queue->capacity = REPORT_QUEUE_SIZE;
    queue->size = 0;
    queue->front = 0;
    queue->rear = -1;

    pthread_mutex_init(&queue->mutex, NULL);
    pthread_cond_init(&queue->not_empty, NULL);

    return 0;
}

// Push event to queue
static int push_event(report_queue_t *queue, report_event_t *event) {
    pthread_mutex_lock(&queue->mutex);
    
    if (queue->size >= queue->capacity) {
        pthread_mutex_unlock(&queue->mutex);
        DBG_ERROR("Report queue is full");
        return -1;
    }

    queue->rear = (queue->rear + 1) % queue->capacity;
    queue->events[queue->rear] = *event;
    queue->size++;

    pthread_cond_signal(&queue->not_empty);
    pthread_mutex_unlock(&queue->mutex);
    return 0;
}

// Pop event from queue
static int pop_event(report_queue_t *queue, report_event_t *event) {
    pthread_mutex_lock(&queue->mutex);
    
    while (queue->size == 0 && g_report_ctx.running) {
        pthread_cond_wait(&queue->not_empty, &queue->mutex);
    }

    if (!g_report_ctx.running) {
        pthread_mutex_unlock(&queue->mutex);
        return -1;
    }

    *event = queue->events[queue->front];
    queue->front = (queue->front + 1) % queue->capacity;
    queue->size--;

    pthread_mutex_unlock(&queue->mutex);
    return 0;
}

// Initialize node value lookup table
static void init_node_lookup(void) {
    device_t *device = device_get_config();
    if (!device) {
        DBG_ERROR("Device configuration not available");
        return;
    }

    g_node_lookup_count = 0;
    while (device && g_node_lookup_count < MAX_NODES) {
        node_t *node = device->nodes;
        while (node && g_node_lookup_count < MAX_NODES) {
            g_node_lookup[g_node_lookup_count].node_name = node->name;
            g_node_lookup[g_node_lookup_count].value = &node->value;
            g_node_lookup[g_node_lookup_count].previous_value = &node->previous_value;
            g_node_lookup[g_node_lookup_count].data_type = node->data_type;
            g_node_lookup[g_node_lookup_count].is_ok = node->is_ok;
            g_node_lookup[g_node_lookup_count].read_status = node->read_status;
            g_node_lookup[g_node_lookup_count].enable_reporting = node->enable_reporting;
            g_node_lookup[g_node_lookup_count].variation_range = node->variation_range;
            g_node_lookup_count++;
            node = node->next;
        }
        device = device->next;
    }

    DBG_INFO("Initialized node lookup table with %d nodes", g_node_lookup_count);
}

// Get node value from lookup table
static node_lookup_t* get_node_from_lookup(const char *node_name) {
    for (int i = 0; i < g_node_lookup_count; i++) {
        if (strcmp(g_node_lookup[i].node_name, node_name) == 0) {
            return &g_node_lookup[i];
        }
    }
    return NULL;
}

// Get system value by name
static const char* get_system_value(const char *name) {
    if (!name) {
        return NULL;
    }

    if (strcmp(name, SYS_SN) == 0) {
        return "123456789";  // Replace with actual system serial number
    }
    else if (strcmp(name, SYS_MAC) == 0) {
        return "00:11:22:33:44:55";  // Replace with actual MAC address
    }
    else if (strcmp(name, SYS_IMEI) == 0) {
        return "123456789012345";  // Replace with actual IMEI
    }
    else if (strcmp(name, SYS_ICCID) == 0) {
        return "89882470000012345678";  // Replace with actual ICCID
    }
    else if (strcmp(name, SYS_TIME) == 0) {
        static char time_str[32];
        time_t now;
        struct tm *tm_info;
        
        time(&now);
        tm_info = gmtime(&now);  // Use GMT time
        
        // Format: YYYY-MM-DD HH:MM:SS
        strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S", tm_info);
        return time_str;
    }
    else if (strcmp(name, SYS_UNIX_TIME) == 0) {
        static char time_str[32];
        time_t now;
        
        time(&now);
        snprintf(time_str, sizeof(time_str), "%ld", now);
        return time_str;
    }

    return NULL;
}

// Process a single JSON value
static void process_json_value(cJSON *value, report_config_t *config) {
    if (!value) {
        return;
    }

    switch (value->type) {
        case cJSON_String:
            // First check if it's a system value
            const char *sys_value = get_system_value(value->valuestring);
            if (sys_value) {
                cJSON_SetValuestring(value, sys_value);
            }
            // If not a system value, check node lookup table
            else {
                node_lookup_t *node_lookup = get_node_from_lookup(value->valuestring);
                if (node_lookup) {
                    // Check if failure padding is enabled and node status is error
                    if (config->failure_padding_enabled && 
                        (!node_lookup->is_ok || node_lookup->read_status != 0)) {
                        // Use failure padding content
                        cJSON_SetValuestring(value, config->failure_padding_content);
                    } else {
                        // Convert value to string if quotation mark is enabled
                        if (config->quotation_mark) {
                            char value_str[32] = {0};
                            switch (node_lookup->data_type) {
                                case DATA_TYPE_BOOLEAN:
                                    snprintf(value_str, sizeof(value_str), "%d", node_lookup->value->bool_val);
                                    break;
                                case DATA_TYPE_INT8:
                                    snprintf(value_str, sizeof(value_str), "%d", node_lookup->value->int8_val);
                                    break;
                                case DATA_TYPE_UINT8:
                                    snprintf(value_str, sizeof(value_str), "%u", node_lookup->value->uint8_val);
                                    break;
                                case DATA_TYPE_INT16:
                                    snprintf(value_str, sizeof(value_str), "%d", node_lookup->value->int16_val);
                                    break;
                                case DATA_TYPE_UINT16:
                                    snprintf(value_str, sizeof(value_str), "%u", node_lookup->value->uint16_val);
                                    break;
                                case DATA_TYPE_INT32_ABCD:
                                case DATA_TYPE_INT32_CDAB:
                                    snprintf(value_str, sizeof(value_str), "%ld", node_lookup->value->int32_val);
                                    break;
                                case DATA_TYPE_UINT32_ABCD:
                                case DATA_TYPE_UINT32_CDAB:
                                    snprintf(value_str, sizeof(value_str), "%lu", node_lookup->value->uint32_val);
                                    break;
                                case DATA_TYPE_FLOAT_ABCD:
                                case DATA_TYPE_FLOAT_CDAB:
                                    snprintf(value_str, sizeof(value_str), "%.6f", node_lookup->value->float_val);
                                    break;
                                case DATA_TYPE_DOUBLE:
                                    snprintf(value_str, sizeof(value_str), "%.6f", node_lookup->value->double_val);
                                    break;
                                default:
                                    DBG_ERROR("Unsupported data type for node %s", value->valuestring);
                                    break;
                            }
                            cJSON_SetValuestring(value, value_str);
                        } else {
                            // Set numeric value directly
                            switch (node_lookup->data_type) {
                                case DATA_TYPE_BOOLEAN:
                                    cJSON_SetBoolValue(value, node_lookup->value->bool_val);
                                    break;
                                case DATA_TYPE_INT8:
                                    cJSON_SetNumberValue(value, node_lookup->value->int8_val);
                                    break;
                                case DATA_TYPE_UINT8:
                                    cJSON_SetNumberValue(value, node_lookup->value->uint8_val);
                                    break;
                                case DATA_TYPE_INT16:
                                    cJSON_SetNumberValue(value, node_lookup->value->int16_val);
                                    break;
                                case DATA_TYPE_UINT16:
                                    cJSON_SetNumberValue(value, node_lookup->value->uint16_val);
                                    break;
                                case DATA_TYPE_INT32_ABCD:
                                case DATA_TYPE_INT32_CDAB:
                                    cJSON_SetNumberValue(value, node_lookup->value->int32_val);
                                    break;
                                case DATA_TYPE_UINT32_ABCD:
                                case DATA_TYPE_UINT32_CDAB:
                                    cJSON_SetNumberValue(value, node_lookup->value->uint32_val);
                                    break;
                                case DATA_TYPE_FLOAT_ABCD:
                                case DATA_TYPE_FLOAT_CDAB:
                                    cJSON_SetNumberValue(value, node_lookup->value->float_val);
                                    break;
                                case DATA_TYPE_DOUBLE:
                                    cJSON_SetNumberValue(value, node_lookup->value->double_val);
                                    break;
                                default:
                                    DBG_ERROR("Unsupported data type for node %s", value->valuestring);
                                    break;
                            }
                        }
                    }
                } else {
                    DBG_WARN("Node not found in lookup table: %s", value->valuestring);
                }
            }
            break;

        case cJSON_Object:
            // Process all children of the object
            cJSON *child = value->child;
            while (child) {
                process_json_value(child, config);
                child = child->next;
            }
            break;

        case cJSON_Array:
            // Process all elements in the array
            cJSON *element = value->child;
            while (element) {
                process_json_value(element, config);
                element = element->next;
            }
            break;

        default:
            // Other types (number, boolean, null) are left unchanged
            break;
    }
}

// Process JSON template and replace all node values
static char* process_json_template(const char *template_str) {
    if (!template_str) {
        DBG_ERROR("Invalid template string");
        return NULL;
    }

    cJSON *root = cJSON_Parse(template_str);
    if (!root) {
        DBG_ERROR("Failed to parse JSON template");
        return NULL;
    }

    report_config_t *config = report_get_config();
    if (!config) {
        DBG_ERROR("Failed to get report configuration");
        cJSON_Delete(root);
        return NULL;
    }

    // Process the root JSON value
    process_json_value(root, config);

    // Convert to string
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str) {
        DBG_ERROR("Failed to convert JSON to string");
        return NULL;
    }

    return json_str;
}

// Check if it's time for regular reporting
static bool is_regular_report_time(report_config_t *config) {
    if (!config->regular_enabled) {
        return false;
    }

    time_t now;
    struct tm *tm_info;
    char time_str[8];
    
    time(&now);
    tm_info = localtime(&now);
    
    switch (config->regular_interval_type) {
        case REGULAR_INTERVAL_FIXED_TIME:
            // Report at fixed time (HHMMSS)
            strftime(time_str, sizeof(time_str), "%H%M%S", tm_info);
            return (atoi(time_str) == config->regular_fixed_time);
            
        case REGULAR_INTERVAL_EVERY_MINUTE:
            // Report at the start of every minute
            return (tm_info->tm_sec == 0);
            
        case REGULAR_INTERVAL_EVERY_QUARTER:
            // Report at 00:00, 00:15, 00:30, 00:45
            return (tm_info->tm_min % 15 == 0 && tm_info->tm_sec == 0);
            
        case REGULAR_INTERVAL_EVERY_HOUR:
            // Report at the start of every hour
            return (tm_info->tm_min == 0 && tm_info->tm_sec == 0);
            
        case REGULAR_INTERVAL_EVERY_DAY:
            // Report at midnight
            return (tm_info->tm_hour == 0 && tm_info->tm_min == 0 && tm_info->tm_sec == 0);
            
        default:
            DBG_ERROR("Invalid regular interval type: %d", config->regular_interval_type);
            return false;
    }
}

// Report handle thread function
static void* report_handle_thread(void *arg) {
    report_config_t *config = report_get_config();
    if (!config) {
        DBG_ERROR("Failed to get report configuration");
        return NULL;
    }

    time_t last_periodic_report = 0;
    time_t last_regular_report = 0;

    DBG_INFO("Report handle thread started");

    while (g_report_ctx.running) {
        time_t now;
        time(&now);

        // Check for periodic reporting
        if (config->periodic_enabled && 
            (now - last_periodic_report) >= config->periodic_interval) {
            char *json_data = process_json_template(config->json_template);
            if (json_data) {
                if (mqtt_is_enabled()) {
                    mqtt_publish(config->mqtt_topic, json_data, 
                               config->mqtt_qos, config->mqtt_retained_message);
                }
                free(json_data);
            }
            last_periodic_report = now;
        }

        // Check for regular reporting
        if (is_regular_report_time(config) && 
            (now - last_regular_report) >= 1) { // Minimum 1 second between reports
            char *json_data = process_json_template(config->json_template);
            if (json_data) {
                if (mqtt_is_enabled()) {
                    mqtt_publish(config->mqtt_topic, json_data, 
                               config->mqtt_qos, config->mqtt_retained_message);
                }
                free(json_data);
            }
            last_regular_report = now;
        }

        // Process any events from the queue (value change events)
        report_event_t event;
        if (pop_event(&g_report_ctx.queue, &event) == 0) {
            char *json_data = process_json_template(config->json_template);
            if (json_data) {
                if (mqtt_is_enabled()) {
                    mqtt_publish(config->mqtt_topic, json_data, 
                               config->mqtt_qos, config->mqtt_retained_message);
                }
                free(json_data);
            }
        }

        // Sleep for a short interval to prevent busy waiting
        usleep(100000); // 100ms
    }

    return NULL;
}

// Initialize report handle
int report_handle_init(void) {
    if (init_report_queue(&g_report_ctx.queue) != 0) {
        return -1;
    }

    g_report_ctx.running = false;
    
    // Initialize node lookup table
    init_node_lookup();
    
    return 0;
}

// Start report handle thread
void report_handle_start(void) {
    if (g_report_ctx.running) {
        DBG_WARN("Report handle thread is already running");
        return;
    }

    g_report_ctx.running = true;
    pthread_create(&g_report_ctx.thread, NULL, report_handle_thread, NULL);
    DBG_INFO("Report handle thread started");
}

// Stop report handle thread
void report_handle_stop(void) {
    if (!g_report_ctx.running) {
        return;
    }

    g_report_ctx.running = false;
    pthread_cond_signal(&g_report_ctx.queue.not_empty);
    pthread_join(g_report_ctx.thread, NULL);
    DBG_INFO("Report handle thread stopped");
}

// Push event to report queue
int report_handle_push_event(report_event_t *event) {
    if (!event) {
        DBG_ERROR("Invalid event parameter");
        return -1;
    }

    return push_event(&g_report_ctx.queue, event);
}

// Cleanup report handle resources
void report_handle_cleanup(void) {
    report_handle_stop();
    
    if (g_report_ctx.queue.events) {
        free(g_report_ctx.queue.events);
    }
    
    pthread_mutex_destroy(&g_report_ctx.queue.mutex);
    pthread_cond_destroy(&g_report_ctx.queue.not_empty);
    
    memset(&g_report_ctx, 0, sizeof(g_report_ctx));
}
