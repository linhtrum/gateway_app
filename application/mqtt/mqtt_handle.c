#include "mqtt_handle.h"
#include "mqtt.h"
#include <MQTTAsync.h>
#include <time.h>
#include <string.h>
#include <pthread.h>

#define DBG_TAG "MQTT_HANDLE"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define MQTT_CLIENT_ID_MAX_LEN 64
#define MQTT_SERVER_ADDR_MAX_LEN 128
#define MQTT_USERNAME_MAX_LEN 32
#define MQTT_PASSWORD_MAX_LEN 32

// MQTT client handle
static bool mqtt_connected = false;
static mqtt_config_t *mqtt_config = NULL;
static mqtt_topics_t *mqtt_topics = NULL;

static MQTTAsync mqtt_async_client = NULL;
static MQTTAsync_connectOptions mqtt_conn_opts = MQTTAsync_connectOptions_initializer;
static MQTTAsync_willOptions mqtt_will_opts = MQTTAsync_willOptions_initializer;


// MQTT message callback
static int mqtt_message_arrived(void *context, char *topicName, int topicLen, MQTTAsync_message *message) {
    DBG_INFO("Message received on topic: %s", topicName);
    
    // Create a null-terminated copy of the message
    char *payload = calloc(message->payloadlen + 1, sizeof(char));
    if (!payload) {
        DBG_ERROR("Failed to allocate memory for message payload");
        return 1;
    }
    
    memcpy(payload, message->payload, message->payloadlen);
    payload[message->payloadlen] = '\0';
    
    // TODO: Handle the message based on topic
    // You can add your message handling logic here
    
    DBG_DEBUG("Message payload: %s", payload);
    free(payload);
    
    MQTTAsync_freeMessage(&message);
    MQTTAsync_free(topicName);
    return 1;
}

// MQTT connection callback
static void mqtt_connection_lost(void *context, char *cause) {
    MQTTAsync client = (MQTTAsync)context;

    DBG_WARN("MQTT connection lost, cause: %s", cause ? cause : "unknown");
    mqtt_connected = false;

    // MQTTAsync_connect(client, &mqtt_conn_opts);
}

// MQTT message delivery complete callback
// static void mqtt_delivery_complete(void *context, MQTTClient_deliveryToken dt) {
//     DBG_DEBUG("MQTT message delivery complete, token: %d", dt);
// }


void onSubscribe(void* context, MQTTAsync_successData* response)
{
	DBG_INFO("Subscribe succeeded");
}

void onSubscribeFailure(void* context, MQTTAsync_failureData* response)
{
	DBG_ERROR("Subscribe failed, rc %d", response->code);
}

void mqtt_connection_success(void* context, MQTTAsync_successData* response) {
    // MQTTAsync client = (MQTTAsync)context;
	// MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;

    DBG_INFO("MQTT connection success");

    // mqtt_connected = true;
    // opts.onSuccess = onSubscribe;
    // opts.onFailure = onSubscribeFailure;
    // opts.context = client;

    // mqtt_topics_t *topics = mqtt_get_topics();
    // if (!topics) {
    //     DBG_ERROR("Failed to get MQTT topics");
    //     return;
    // }
    // for (uint8_t i = 0; i < topics->sub_count; i++) {
    //     mqtt_sub_topic_t *topic = &topics->sub_topics[i];
    //     if (!topic->enabled) {
    //         continue;
    //     }
    //     int rc = MQTTAsync_subscribe(client, topic->topic_string, topic->qos, &opts);
    //     if (rc != MQTTASYNC_SUCCESS) {
    //         DBG_ERROR("Failed to subscribe to topic: %s, code: %d", topic->topic_string, rc);
    //     } else {
    //         DBG_INFO("Subscribed to topic: %s (QoS: %d)", topic->topic_string, topic->qos);
    //     }
    // }
}

void mqtt_connection_failure(void *context, MQTTAsync_failureData* response) {
    DBG_ERROR("MQTT connection failure");
}

// Connect to MQTT server asynchronously
bool mqtt_connect_async(void) {
    if (mqtt_connected) {
        DBG_WARN("MQTT already connected");
        return true;
    }

    mqtt_config = mqtt_get_config();
    mqtt_topics = mqtt_get_topics();
    if (!mqtt_config || !mqtt_config->enabled) {
        DBG_WARN("MQTT is disabled");
        return false;
    }

    // Create server address string
    char server_addr[MQTT_SERVER_ADDR_MAX_LEN];
    snprintf(server_addr, sizeof(server_addr), "tcp://%s:%d", 
             mqtt_config->server_address, mqtt_config->port);

    // Create client ID
    char client_id[MQTT_CLIENT_ID_MAX_LEN];
    if (strlen(mqtt_config->client_id) == 0) {
        snprintf(client_id, sizeof(client_id), "device_%d", (int)time(NULL));
    } else {
        strncpy(client_id, mqtt_config->client_id, sizeof(client_id) - 1);
    }

    // Create MQTT client
    int rc = MQTTAsync_create(&mqtt_async_client, server_addr, client_id,
                              MQTTCLIENT_PERSISTENCE_NONE, NULL);
    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to create MQTT client, code: %d", rc);
        return false;
    }

    // Set callbacks
    rc = MQTTAsync_setCallbacks(mqtt_async_client, mqtt_async_client, mqtt_connection_lost, mqtt_message_arrived, 
                                NULL);
    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to set MQTT callbacks, code: %d", rc);
        MQTTAsync_destroy(&mqtt_async_client);
        return false;
    }

    // Set connection options
    mqtt_conn_opts.keepAliveInterval = mqtt_config->keep_alive;
    mqtt_conn_opts.cleansession = mqtt_config->clean_session;
    mqtt_conn_opts.retryInterval = mqtt_config->reconnect_interval;
    mqtt_conn_opts.onSuccess = mqtt_connection_success;
    mqtt_conn_opts.onFailure = mqtt_connection_failure;
    mqtt_conn_opts.context = mqtt_async_client;

    // Set authentication if enabled
    if (mqtt_config->use_credentials) {
        mqtt_conn_opts.username = mqtt_config->username;
        mqtt_conn_opts.password = mqtt_config->password;
    }

    // Set last will if enabled
    if(mqtt_config->enable_last_will) {
        mqtt_will_opts.topicName = mqtt_config->last_will_topic;
        mqtt_will_opts.message = mqtt_config->last_will_message;
        mqtt_will_opts.qos = mqtt_config->last_will_qos;
        mqtt_will_opts.retained = mqtt_config->last_will_retained;
        mqtt_conn_opts.will = &mqtt_will_opts;
    }

    // Connect to MQTT server asynchronously
    rc = MQTTAsync_connect(mqtt_async_client, &mqtt_conn_opts);
    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to initiate async connection to MQTT server, code: %d", rc);
        MQTTAsync_destroy(&mqtt_async_client);
        return false;
    }

    return true;
}

// Disconnect from MQTT server
void mqtt_disconnect(void) {
    if (!mqtt_connected || !mqtt_async_client) {
        return;
    }

    MQTTAsync_disconnect(mqtt_async_client, 10000);
    MQTTAsync_destroy(&mqtt_async_client);
    mqtt_async_client = NULL;
    mqtt_connected = false;
    DBG_INFO("Disconnected from MQTT server");
}

// Check if MQTT is connected
bool mqtt_is_connected(void) {
    return mqtt_connected;
}

