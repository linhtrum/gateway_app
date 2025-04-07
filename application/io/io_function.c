#include "io_function.h"
#include "db.h"
#include "debug.h"
#include <string.h>
#include <stdlib.h>
#include <cJSON.h>

// Static configuration
static io_function_config_t g_io_function_config = {0};

// Initialize IO function configuration
int io_function_init(void) {
    // Try to load configuration from database
    char json_str[4096] = {0};
    int read_len = db_read("io_function_config", json_str, sizeof(json_str));

    if (read_len <= 0) {
        DBG_ERROR("Failed to read IO function configuration from database");
        return -1;
    }

    if (!io_function_parse_config(json_str)) {
        DBG_ERROR("Failed to parse IO function configuration");
        return -1;
    }

    DBG_INFO("IO function configuration initialized");
    return 0;
}

// Parse IO function configuration from JSON string
bool io_function_parse_config(const char *json_str) {
    if (!json_str) {
        return false;
    }
    
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse JSON string");
        return false;
    }
    
    // Parse slave address
    cJSON *slave_addr = cJSON_GetObjectItem(root, "slaveAddress");
    if (cJSON_IsNumber(slave_addr)) {
        g_io_function_config.slave_address = (uint8_t)slave_addr->valueint;
    }
    
    // Parse timers array
    cJSON *timers = cJSON_GetObjectItem(root, "timers");
    if (cJSON_IsArray(timers)) {
        int timer_count = cJSON_GetArraySize(timers);
        for (int i = 0; i < timer_count && i < 6; i++) {
            cJSON *timer = cJSON_GetArrayItem(timers, i);
            if (timer) {
                // Parse timer enabled
                cJSON *enabled = cJSON_GetObjectItem(timer, "enabled");
                if (cJSON_IsBool(enabled)) {
                    g_io_function_config.timers[i].enabled = cJSON_IsTrue(enabled);
                }
                
                // Parse timer time
                cJSON *time = cJSON_GetObjectItem(timer, "time");
                if (cJSON_IsString(time)) {
                    strncpy(g_io_function_config.timers[i].time, time->valuestring, sizeof(g_io_function_config.timers[i].time) - 1);
                }
                
                // Parse timer action
                cJSON *action = cJSON_GetObjectItem(timer, "action");
                if (cJSON_IsNumber(action)) {
                    g_io_function_config.timers[i].action = (timer_action_t)action->valueint;
                }
                
                // Parse DO action
                cJSON *do_action = cJSON_GetObjectItem(timer, "doAction");
                if (cJSON_IsNumber(do_action)) {
                    g_io_function_config.timers[i].do_action = (uint8_t)do_action->valueint;
                }
                
                // Parse DO action type
                cJSON *do_action_type = cJSON_GetObjectItem(timer, "doActionType");
                if (cJSON_IsNumber(do_action_type)) {
                    g_io_function_config.timers[i].do_action_type = (timer_do_action_t)do_action_type->valueint;
                }
            }
        }
    }
    
    // Parse restart hold
    cJSON *restart_hold = cJSON_GetObjectItem(root, "restartHold");
    if (cJSON_IsBool(restart_hold)) {
        g_io_function_config.restart_hold = cJSON_IsTrue(restart_hold);
    }
    
    // Parse execute actions
    cJSON *execute_action_do1 = cJSON_GetObjectItem(root, "executeActionDO1");
    if (cJSON_IsNumber(execute_action_do1)) {
        g_io_function_config.execute_action_do1 = (uint8_t)execute_action_do1->valueint;
    }
    
    cJSON *execute_action_do2 = cJSON_GetObjectItem(root, "executeActionDO2");
    if (cJSON_IsNumber(execute_action_do2)) {
        g_io_function_config.execute_action_do2 = (uint8_t)execute_action_do2->valueint;
    }
    
    // Parse execute times
    cJSON *execute_time_do1 = cJSON_GetObjectItem(root, "executeTimeDO1");
    if (cJSON_IsNumber(execute_time_do1)) {
        g_io_function_config.execute_time_do1 = (uint8_t)execute_time_do1->valueint;
    }
    
    cJSON *execute_time_do2 = cJSON_GetObjectItem(root, "executeTimeDO2");
    if (cJSON_IsNumber(execute_time_do2)) {
        g_io_function_config.execute_time_do2 = (uint8_t)execute_time_do2->valueint;
    }
    
    // Parse filter time
    cJSON *filter_time = cJSON_GetObjectItem(root, "filterTime");
    if (cJSON_IsNumber(filter_time)) {
        g_io_function_config.filter_time = (uint8_t)filter_time->valueint;
    }
    
    cJSON_Delete(root);
    return true;
}

// Get current IO function configuration
io_function_config_t* io_function_get_config(void) {
    return &g_io_function_config;
}

