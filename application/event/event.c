#include "event.h"
#include "cJSON.h"
#include "../database/db.h"
#include "../log/log_output.h"

#define DBG_TAG "EVENT"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Static event configuration structure
static event_config_t g_event_data = {0};

// Parse event configuration from JSON
static bool parse_event_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    // Parse JSON
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse event config JSON");
        return false;
    }

    // Clear existing config
    memset(&g_event_data.events, 0, sizeof(g_event_data.events));
    g_event_data.count = 0;

    // Parse events array
    int array_size = cJSON_GetArraySize(root);
    g_event_data.count = (array_size > MAX_EVENTS) ? MAX_EVENTS : array_size;

    int enabled_count = 0;
    for (int i = 0; i < g_event_data.count; i++) {
        cJSON *event = cJSON_GetArrayItem(root, i);
        if (!event) continue;

        event_data_t *evt = &g_event_data.events[i];

        // Parse event fields
        cJSON *name = cJSON_GetObjectItem(event, "n");
        if (name && name->valuestring) {
            strncpy(evt->name, name->valuestring, sizeof(evt->name) - 1);
        }

        cJSON *enabled = cJSON_GetObjectItem(event, "e");
        evt->enabled = enabled ? cJSON_IsTrue(enabled) : false;
        if (evt->enabled) enabled_count++;

        cJSON *condition = cJSON_GetObjectItem(event, "c");
        evt->condition = condition ? condition->valueint : 0;

        cJSON *point = cJSON_GetObjectItem(event, "p");
        if (point && point->valuestring) {
            strncpy(evt->point, point->valuestring, sizeof(evt->point) - 1);
        }

        cJSON *scan_cycle = cJSON_GetObjectItem(event, "sc");
        evt->scan_cycle = scan_cycle ? scan_cycle->valueint : 1000; // Default 1 second

        cJSON *min_interval = cJSON_GetObjectItem(event, "mi");
        evt->min_interval = min_interval ? min_interval->valueint : 0;

        cJSON *upper_threshold = cJSON_GetObjectItem(event, "ut");
        evt->upper_threshold = upper_threshold ? upper_threshold->valueint : 0;

        cJSON *lower_threshold = cJSON_GetObjectItem(event, "lt");
        evt->lower_threshold = lower_threshold ? lower_threshold->valueint : 0;

        cJSON *trigger_exec = cJSON_GetObjectItem(event, "te");
        evt->trigger_exec = trigger_exec ? trigger_exec->valueint : 0;

        cJSON *trigger_action = cJSON_GetObjectItem(event, "ta");
        evt->trigger_action = trigger_action ? trigger_action->valueint : 0;

        cJSON *description = cJSON_GetObjectItem(event, "d");
        if (description && description->valuestring) {
            strncpy(evt->description, description->valuestring, sizeof(evt->description) - 1);
        }

        cJSON *id = cJSON_GetObjectItem(event, "id");
        evt->id = id ? id->valuedouble : 0;

        // Initialize timer-related fields
        evt->timer_active = false;
        evt->last_trigger = 0;
        evt->last_value = 0.0f;
        evt->is_triggered = false;
        evt->initial_state = 0;  // Default to Normal Open
    }

    DBG_INFO("Parsed event configuration: %d total events, %d enabled", 
             g_event_data.count, enabled_count);

    cJSON_Delete(root);
    return true;
}

// Load event configuration from database
static bool event_load_config(void) {
    char config_str[4*4096] = {0};

    // Read config from database
    int read_len = db_read("event_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read event config from database");
        return false;
    }

    if (!parse_event_config(config_str)) {
        DBG_ERROR("Failed to parse event config");
        return false;
    }

    return true;
}

// Initialize event configuration
void event_init(void) {
    if (!event_load_config()) {
        DBG_ERROR("Failed to load event configuration");
        return;
    }

    g_event_data.is_initialized = true;
    DBG_INFO("Event configuration initialized successfully");
}

// Get event configuration
event_config_t* event_get_config(void) {
    if (!g_event_data.is_initialized) {
        return NULL;
    }
    return &g_event_data;
}

// Get number of events
int event_get_count(void) {
    return g_event_data.count;
}

// Deinitialize event configuration
void event_deinit(void) {
    if (!g_event_data.is_initialized) {
        return;
    }

    // Stop all active timers
    for (int i = 0; i < g_event_data.count; i++) {
        event_data_t *evt = &g_event_data.events[i];
        if (evt->timer_active) {
            evt->timer_active = false;
            timer_delete(evt->timer);
        }
    }

    // Clear configuration
    memset(&g_event_data.events, 0, sizeof(g_event_data.events));
    g_event_data.count = 0;
    g_event_data.is_initialized = false;
    
    DBG_INFO("Event configuration deinitialized");
}



