#include "mqtt.h"
#include "cJSON.h"
#include "../database/db.h"
#include "../log/log_output.h"
#include <string.h>
#include <stdlib.h>

#define DBG_TAG "MQTT"
#define DBG_LVL LOG_INFO
#include "dbg.h"

// Static MQTT configuration
static mqtt_config_t g_mqtt_config = {0};

// Static MQTT topics
static mqtt_topics_t g_mqtt_topics = {0};

// Parse MQTT configuration from JSON
static bool parse_mqtt_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse MQTT config JSON");
        return false;
    }

    // Parse configuration fields
    cJSON *enabled = cJSON_GetObjectItem(root, "enabled");
    if (enabled) {
        g_mqtt_config.enabled = cJSON_IsTrue(enabled);
    }

    cJSON *version = cJSON_GetObjectItem(root, "version");
    if (version) {
        g_mqtt_config.version = version->valueint;
    }

    cJSON *client_id = cJSON_GetObjectItem(root, "clientId");
    if (client_id && client_id->valuestring) {
        strncpy(g_mqtt_config.client_id, client_id->valuestring, sizeof(g_mqtt_config.client_id) - 1);
    }

    cJSON *server_address = cJSON_GetObjectItem(root, "serverAddress");
    if (server_address && server_address->valuestring) {
        strncpy(g_mqtt_config.server_address, server_address->valuestring, sizeof(g_mqtt_config.server_address) - 1);
    }

    cJSON *port = cJSON_GetObjectItem(root, "port");
    if (port) {
        g_mqtt_config.port = port->valueint;
    }

    cJSON *keep_alive = cJSON_GetObjectItem(root, "keepAlive");
    if (keep_alive) {
        g_mqtt_config.keep_alive = keep_alive->valueint;
    }

    cJSON *reconnect_no_data = cJSON_GetObjectItem(root, "reconnectNoData");
    if (reconnect_no_data) {
        g_mqtt_config.reconnect_no_data = reconnect_no_data->valueint;
    }

    cJSON *reconnect_interval = cJSON_GetObjectItem(root, "reconnectInterval");
    if (reconnect_interval) {
        g_mqtt_config.reconnect_interval = reconnect_interval->valueint;
    }

    cJSON *clean_session = cJSON_GetObjectItem(root, "cleanSession");
    if (clean_session) {
        g_mqtt_config.clean_session = cJSON_IsTrue(clean_session);
    }

    cJSON *use_credentials = cJSON_GetObjectItem(root, "useCredentials");
    if (use_credentials) {
        g_mqtt_config.use_credentials = cJSON_IsTrue(use_credentials);
    }

    cJSON *username = cJSON_GetObjectItem(root, "username");
    if (username && username->valuestring) {
        strncpy(g_mqtt_config.username, username->valuestring, sizeof(g_mqtt_config.username) - 1);
    }

    cJSON *password = cJSON_GetObjectItem(root, "password");
    if (password && password->valuestring) {
        strncpy(g_mqtt_config.password, password->valuestring, sizeof(g_mqtt_config.password) - 1);
    }

    cJSON *enable_last_will = cJSON_GetObjectItem(root, "enableLastWill");
    if (enable_last_will) {
        g_mqtt_config.enable_last_will = cJSON_IsTrue(enable_last_will);
    }

    cJSON *last_will_topic = cJSON_GetObjectItem(root, "lastWillTopic");
    if (last_will_topic && last_will_topic->valuestring) {
        strncpy(g_mqtt_config.last_will_topic, last_will_topic->valuestring, sizeof(g_mqtt_config.last_will_topic) - 1);
    }
    
    cJSON *last_will_message = cJSON_GetObjectItem(root, "lastWillMessage");
    if (last_will_message && last_will_message->valuestring) {
        strncpy(g_mqtt_config.last_will_message, last_will_message->valuestring, sizeof(g_mqtt_config.last_will_message) - 1);
    }

    cJSON *last_will_qos = cJSON_GetObjectItem(root, "lastWillQos");
    if (last_will_qos) {
        g_mqtt_config.last_will_qos = last_will_qos->valueint;
    }

    cJSON *last_will_retained = cJSON_GetObjectItem(root, "lastWillRetained");
    if (last_will_retained) {
        g_mqtt_config.last_will_retained = cJSON_IsTrue(last_will_retained);
    }

    cJSON_Delete(root);
    return true;
}

// Get MQTT configuration
mqtt_config_t* mqtt_get_config(void) {
    return &g_mqtt_config;
}

// Save MQTT configuration from JSON
bool mqtt_save_config_from_json(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    int result = db_write("mqtt_config", json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write MQTT config to database");
        return false;
    }

    return true;
}

// Check if MQTT is enabled
bool mqtt_is_enabled(void) {
    return g_mqtt_config.enabled;
}

// Initialize MQTT configuration
void mqtt_init(void) {
    char config_str[2048] = {0};
    int read_len = db_read("mqtt_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read MQTT config from database");
        return;
    }

    if (!parse_mqtt_config(config_str)) {
        DBG_ERROR("Failed to parse MQTT config");
        return;
    }

    DBG_INFO("MQTT configuration initialized: enabled=%d, server=%s:%d", 
             g_mqtt_config.enabled, g_mqtt_config.server_address, g_mqtt_config.port);
}

// Parse publish topic from JSON
static bool parse_pub_topic(cJSON *topic_obj, mqtt_pub_topic_t *topic) {
    if (!topic_obj || !topic) {
        return false;
    }

    cJSON *enabled = cJSON_GetObjectItem(topic_obj, "enabled");
    if (enabled) {
        topic->enabled = cJSON_IsTrue(enabled);
    }

    cJSON *transmission_mode = cJSON_GetObjectItem(topic_obj, "transmissionMode");
    if (transmission_mode) {
        topic->transmission_mode = transmission_mode->valueint;
    }

    cJSON *topic_string = cJSON_GetObjectItem(topic_obj, "topicString");
    if (topic_string && topic_string->valuestring) {
        strncpy(topic->topic_string, topic_string->valuestring, sizeof(topic->topic_string) - 1);
    }

    cJSON *topic_alias = cJSON_GetObjectItem(topic_obj, "topicAlias");
    if (topic_alias && topic_alias->valuestring) {
        strncpy(topic->topic_alias, topic_alias->valuestring, sizeof(topic->topic_alias) - 1);
    }

    cJSON *binding_ports = cJSON_GetObjectItem(topic_obj, "bindingPorts");
    if (binding_ports) {
        topic->binding_ports = binding_ports->valueint;
    }

    cJSON *qos = cJSON_GetObjectItem(topic_obj, "qos");
    if (qos) {
        topic->qos = qos->valueint;
    }

    cJSON *retained_message = cJSON_GetObjectItem(topic_obj, "retainedMessage");
    if (retained_message) {
        topic->retained_message = cJSON_IsTrue(retained_message);
    }

    cJSON *io_control_query = cJSON_GetObjectItem(topic_obj, "ioControlQuery");
    if (io_control_query) {
        topic->io_control_query = cJSON_IsTrue(io_control_query);
    }

    return true;
}

// Parse subscribe topic from JSON
static bool parse_sub_topic(cJSON *topic_obj, mqtt_sub_topic_t *topic) {
    if (!topic_obj || !topic) {
        return false;
    }

    cJSON *enabled = cJSON_GetObjectItem(topic_obj, "enabled");
    if (enabled) {
        topic->enabled = cJSON_IsTrue(enabled);
    }

    cJSON *transmission_mode = cJSON_GetObjectItem(topic_obj, "transmissionMode");
    if (transmission_mode) {
        topic->transmission_mode = transmission_mode->valueint;
    }

    cJSON *topic_string = cJSON_GetObjectItem(topic_obj, "topicString");
    if (topic_string && topic_string->valuestring) {
        strncpy(topic->topic_string, topic_string->valuestring, sizeof(topic->topic_string) - 1);
    }

    cJSON *delimiter = cJSON_GetObjectItem(topic_obj, "delimiter");
    if (delimiter && delimiter->valuestring) {
        strncpy(topic->delimiter, delimiter->valuestring, sizeof(topic->delimiter) - 1);
    }

    cJSON *binding_ports = cJSON_GetObjectItem(topic_obj, "bindingPorts");
    if (binding_ports) {
        topic->binding_ports = binding_ports->valueint;
    }

    cJSON *qos = cJSON_GetObjectItem(topic_obj, "qos");
    if (qos) {
        topic->qos = qos->valueint;
    }

    cJSON *io_control_query = cJSON_GetObjectItem(topic_obj, "ioControlQuery");
    if (io_control_query) {
        topic->io_control_query = cJSON_IsTrue(io_control_query);
    }

    return true;
}

bool pub_topic_save_config_from_json(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    int result = db_write("publish_topics", json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write publish topics to database");
        return false;
    }
    return true;
}

bool sub_topic_save_config_from_json(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    int result = db_write("subscribe_topics", json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write subscribe topics to database");
        return false;
    }
    return true;
}

// Initialize MQTT topics
void mqtt_topics_init(void) {
    // Initialize publish topics
    char json_str[4096] = {0};
    int read_len = db_read("publish_topics", json_str, sizeof(json_str));
    json_str[read_len] = '\0';
    if (read_len > 0) {
        cJSON *root = cJSON_Parse(json_str);
        if (root && root->type == cJSON_Array) {
            cJSON *topic;
            cJSON_ArrayForEach(topic, root) {
                if (g_mqtt_topics.pub_count < MQTT_TOPICS_MAX_COUNT) {
                    parse_pub_topic(topic, &g_mqtt_topics.pub_topics[g_mqtt_topics.pub_count]);
                    g_mqtt_topics.pub_count++;
                }
            }
        }
        cJSON_Delete(root);
    }

    // Initialize subscribe topics
    read_len = db_read("subscribe_topics", json_str, sizeof(json_str));
    json_str[read_len] = '\0';
    if (read_len > 0) {
        cJSON *root = cJSON_Parse(json_str);
        if (root && root->type == cJSON_Array) {
            cJSON *topic;
            cJSON_ArrayForEach(topic, root) {
                if (g_mqtt_topics.sub_count < MQTT_TOPICS_MAX_COUNT) {
                    parse_sub_topic(topic, &g_mqtt_topics.sub_topics[g_mqtt_topics.sub_count]);
                    g_mqtt_topics.sub_count++;
                }
            }
        }
        cJSON_Delete(root);
    }

    DBG_INFO("MQTT topics initialized: %d pub topics, %d sub topics", 
             g_mqtt_topics.pub_count, g_mqtt_topics.sub_count);
}

// Get MQTT topics
mqtt_topics_t* mqtt_get_topics(void) {
    return &g_mqtt_topics;
}



