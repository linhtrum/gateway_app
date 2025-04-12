#include "mqtt_handle.h"
#include "mqtt.h"
#include "MQTTAsync.h"
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

static MQTTAsync client;
static pthread_mutex_t mqtt_mutex = PTHREAD_MUTEX_INITIALIZER;

// Callback for connection lost
static void connectionLost(void *context, char *cause) {
    DBG_ERROR("Connection lost, cause: %s", cause);
    // Trigger reconnection logic here
}

// Callback for message arrival
static int messageArrived(void *context, char *topicName, int topicLen, MQTTAsync_message *message) {
    DBG_INFO("Message arrived on topic: %s", topicName);
    DBG_INFO("Message: %.*s", message->payloadlen, (char*)message->payload);

    // Process message here
    
    MQTTAsync_freeMessage(&message);
    MQTTAsync_free(topicName);
    return 1;
}

// Callback for successful connection
static void onConnect(void* context, MQTTAsync_successData* response) {
    DBG_INFO("Connection successful");
}

// Callback for failed connection
static void onConnectFailure(void* context, MQTTAsync_failureData* response) {
    DBG_ERROR("Connect failed, rc: %d", response ? response->code : -1);
}

// Callback for successful subscription
static void onSubscribe(void* context, MQTTAsync_successData* response) {
    DBG_INFO("Subscribe succeeded");
}

// Callback for failed subscription
static void onSubscribeFailure(void* context, MQTTAsync_failureData* response) {
    DBG_ERROR("Subscribe failed, rc: %d", response ? response->code : -1);
}

// Callback for successful publish
static void onPublish(void* context, MQTTAsync_successData* response) {
    DBG_INFO("Message published successfully");
}

// Callback for failed publish
static void onPublishFailure(void* context, MQTTAsync_failureData* response) {
    DBG_ERROR("Publish failed, rc: %d", response ? response->code : -1);
}

// Initialize MQTT client
int mqtt_client_init(void) {
    MQTTAsync_connectOptions conn_opts = MQTTAsync_connectOptions_initializer;
    MQTTAsync_willOptions will_opts = MQTTAsync_willOptions_initializer;
    int rc;

    // Get MQTT configuration
    mqtt_config_t *config = mqtt_get_config();
    if (!config || !config->enabled) {
        DBG_INFO("MQTT is disabled or configuration not available");
        return MQTTASYNC_SUCCESS;
    }

    // Create server address string with port
    char server_addr[MQTT_SERVER_ADDR_MAX_LEN];
    snprintf(server_addr, MQTT_SERVER_ADDR_MAX_LEN, "tcp://%s:%d", 
             config->server_address, config->port);

    char client_id[MQTT_CLIENT_ID_MAX_LEN];
    if (strlen(config->client_id) == 0) {
        snprintf(client_id, sizeof(client_id), "device_%d", (int)time(NULL));
    } else {
        strncpy(client_id, config->client_id, sizeof(client_id) - 1);
    }
    // DBG_INFO("Client ID: %s, length: %d", client_id, strlen(client_id));
    // Create MQTT client instance
    rc = MQTTAsync_create(&client, server_addr, client_id,
                         MQTTCLIENT_PERSISTENCE_NONE, NULL);
    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to create client, rc: %d", rc);
        return rc;
    }

    // Set callback functions
    rc = MQTTAsync_setCallbacks(client, NULL, connectionLost, messageArrived, NULL);
    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to set callbacks, rc: %d", rc);
        return rc;
    }

    // Configure connection options
    conn_opts.keepAliveInterval = config->keep_alive;
    conn_opts.cleansession = config->clean_session;
    conn_opts.onSuccess = onConnect;
    conn_opts.onFailure = onConnectFailure;

    conn_opts.automaticReconnect = true;
    conn_opts.minRetryInterval = config->reconnect_interval;
    conn_opts.maxRetryInterval = config->reconnect_interval * 10;

    // Set authentication if enabled
    if (config->use_credentials) {
        conn_opts.username = config->username;
        conn_opts.password = config->password;
    }

    // Configure last will message if enabled
    if (config->enable_last_will) {
        will_opts.topicName = config->last_will_topic;
        will_opts.message = config->last_will_message;
        will_opts.qos = config->last_will_qos;
        will_opts.retained = config->last_will_retained;
        conn_opts.will = &will_opts;
    }

    // DBG_INFO("Connecting to broker: %s, client ID: %s, username: %s, password: %s, keep alive: %d, clean session: %d, enable last will: %d, last will topic: %s, last will message: %s, last will QoS: %d, last will retained: %d",
    //  server_addr, client_id, config->username, config->password, config->keep_alive, config->clean_session, config->enable_last_will, config->last_will_topic, config->last_will_message, config->last_will_qos, config->last_will_retained);

    // Connect to broker
    rc = MQTTAsync_connect(client, &conn_opts);
    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to start connect, rc: %d", rc);
        return rc;
    }

    DBG_INFO("MQTT client initialized successfully");
    return MQTTASYNC_SUCCESS;
}

// Subscribe to topic
int mqtt_subscribe(const char* topic, int qos) {
    MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    int rc;

    // Check if MQTT is enabled
    if (!mqtt_is_enabled()) {
        DBG_INFO("MQTT is disabled, skipping subscription");
        return MQTTASYNC_SUCCESS;
    }

    opts.onSuccess = onSubscribe;
    opts.onFailure = onSubscribeFailure;

    pthread_mutex_lock(&mqtt_mutex);
    rc = MQTTAsync_subscribe(client, topic, qos, &opts);
    pthread_mutex_unlock(&mqtt_mutex);

    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to start subscribe, rc: %d", rc);
    }

    return rc;
}

// Publish message to topic
int mqtt_publish(const char* topic, const char* payload, int qos, int retained) {
    MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    MQTTAsync_message pubmsg = MQTTAsync_message_initializer;
    int rc;

    // Check if MQTT is enabled
    if (!mqtt_is_enabled()) {
        DBG_INFO("MQTT is disabled, skipping publish");
        return MQTTASYNC_SUCCESS;
    }

    opts.onSuccess = onPublish;
    opts.onFailure = onPublishFailure;

    pubmsg.payload = (void*)payload;
    pubmsg.payloadlen = strlen(payload);
    pubmsg.qos = qos;
    pubmsg.retained = retained;

    pthread_mutex_lock(&mqtt_mutex);
    rc = MQTTAsync_sendMessage(client, topic, &pubmsg, &opts);
    pthread_mutex_unlock(&mqtt_mutex);

    if (rc != MQTTASYNC_SUCCESS) {
        DBG_ERROR("Failed to start publish, rc: %d", rc);
    }

    return rc;
}

// Cleanup MQTT client
void mqtt_client_cleanup(void) {
    pthread_mutex_lock(&mqtt_mutex);
    if (client) {
        MQTTAsync_destroy(&client);
    }
    pthread_mutex_unlock(&mqtt_mutex);
    pthread_mutex_destroy(&mqtt_mutex);
}

