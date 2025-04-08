#include "report.h"
#include "../database/db.h"
#include "cJSON.h"
#include <string.h>

#define DBG_TAG "REPORT"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Static report configuration
static report_config_t g_report_config = {0};

// Parse report configuration from JSON
static bool parse_report_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse report config JSON");
        return false;
    }

    // Parse configuration fields
    cJSON *enabled = cJSON_GetObjectItem(root, "enabled");
    if (enabled) {
        g_report_config.enabled = cJSON_IsTrue(enabled);
    }

    cJSON *channel = cJSON_GetObjectItem(root, "channel");
    if (channel) {
        g_report_config.channel = (report_channel_type_t)channel->valueint;
    }

    cJSON *mqtt_topic = cJSON_GetObjectItem(root, "mqttTopic");
    if (mqtt_topic && mqtt_topic->valuestring) {
        strncpy(g_report_config.mqtt_topic, mqtt_topic->valuestring, sizeof(g_report_config.mqtt_topic) - 1);
    }

    cJSON *mqtt_qos = cJSON_GetObjectItem(root, "mqttQos");
    if (mqtt_qos) {
        g_report_config.mqtt_qos = mqtt_qos->valueint;
    }

    cJSON *periodic_enabled = cJSON_GetObjectItem(root, "periodicEnabled");
    if (periodic_enabled) {
        g_report_config.periodic_enabled = cJSON_IsTrue(periodic_enabled);
    }

    cJSON *periodic_interval = cJSON_GetObjectItem(root, "periodicInterval");
    if (periodic_interval) {
        g_report_config.periodic_interval = periodic_interval->valueint;
    }

    cJSON *regular_enabled = cJSON_GetObjectItem(root, "regularEnabled");
    if (regular_enabled) {
        g_report_config.regular_enabled = cJSON_IsTrue(regular_enabled);
    }

    cJSON *regular_interval_type = cJSON_GetObjectItem(root, "regularInterval");
    if (regular_interval_type) {
        g_report_config.regular_interval_type = (regular_interval_type_t)regular_interval_type->valueint;
    }

    cJSON *regular_fixed_time = cJSON_GetObjectItem(root, "regularFixedTime");
    if (regular_fixed_time && regular_fixed_time->valuestring) {
        // Convert HHMMSS string to integer
        char time_str[7];
        strncpy(time_str, regular_fixed_time->valuestring, 6);
        time_str[6] = '\0';
        g_report_config.regular_fixed_time = atoi(time_str);
    }

    cJSON *failure_padding_enabled = cJSON_GetObjectItem(root, "failurePaddingEnabled");
    if (failure_padding_enabled) {
        g_report_config.failure_padding_enabled = cJSON_IsTrue(failure_padding_enabled);
    }

    cJSON *failure_padding_content = cJSON_GetObjectItem(root, "failurePaddingContent");
    if (failure_padding_content && failure_padding_content->valuestring) {
        strncpy(g_report_config.failure_padding_content, failure_padding_content->valuestring, 
                sizeof(g_report_config.failure_padding_content) - 1);
    }

    cJSON *quotation_mark = cJSON_GetObjectItem(root, "quotationMark");
    if (quotation_mark) {
        g_report_config.quotation_mark = cJSON_IsTrue(quotation_mark);
    } else {
        g_report_config.quotation_mark = false;  // Default to false
    }

    cJSON *json_template = cJSON_GetObjectItem(root, "jsonTemplate");
    if (json_template && json_template->valuestring) {
        strncpy(g_report_config.json_template, json_template->valuestring, 
                sizeof(g_report_config.json_template) - 1);
    }

    cJSON *mqtt_data_query_set = cJSON_GetObjectItem(root, "mqttDataQuerySet");
    if (mqtt_data_query_set) {
        g_report_config.mqtt_data_query_set = cJSON_IsTrue(mqtt_data_query_set);
    }

    cJSON *mqtt_query_set_type = cJSON_GetObjectItem(root, "mqttQuerySetType");
    if (mqtt_query_set_type) {
        g_report_config.mqtt_query_set_type = mqtt_query_set_type->valueint;
    }

    cJSON *mqtt_query_set_topic = cJSON_GetObjectItem(root, "mqttQuerySetTopic");
    if (mqtt_query_set_topic && mqtt_query_set_topic->valuestring) {
        strncpy(g_report_config.mqtt_query_set_topic, mqtt_query_set_topic->valuestring, 
                sizeof(g_report_config.mqtt_query_set_topic) - 1);
    }

    cJSON *mqtt_query_set_qos = cJSON_GetObjectItem(root, "mqttQuerySetQos");
    if (mqtt_query_set_qos) {
        g_report_config.mqtt_query_set_qos = mqtt_query_set_qos->valueint;
    }

    cJSON *mqtt_respond_topic = cJSON_GetObjectItem(root, "mqttRespondTopic");
    if (mqtt_respond_topic && mqtt_respond_topic->valuestring) {
        strncpy(g_report_config.mqtt_respond_topic, mqtt_respond_topic->valuestring, 
                sizeof(g_report_config.mqtt_respond_topic) - 1);
    }

    cJSON *mqtt_respond_qos = cJSON_GetObjectItem(root, "mqttRespondQos");
    if (mqtt_respond_qos) {
        g_report_config.mqtt_respond_qos = mqtt_respond_qos->valueint;
    }

    cJSON *mqtt_retained_message = cJSON_GetObjectItem(root, "mqttRetainedMessage");
    if (mqtt_retained_message) {
        g_report_config.mqtt_retained_message = cJSON_IsTrue(mqtt_retained_message);
    }

    cJSON_Delete(root);
    return true;
}

// Initialize report configuration
int report_init(void) {
    char config_str[4096] = {0};
    int read_len = db_read("report_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read report config from database");
        return -1;
    }

    if (!parse_report_config(config_str)) {
        DBG_ERROR("Failed to parse report config");
        return -1;
    }

    DBG_INFO("Report configuration initialized: enabled=%d, channel=%d, mqtt_topic=%s", 
             g_report_config.enabled, g_report_config.channel, g_report_config.mqtt_topic);
    return 0;
}

// Get report configuration
report_config_t* report_get_config(void) {
    return &g_report_config;
}

// Check if reporting is enabled
bool report_is_enabled(void) {
    return g_report_config.enabled;
}
