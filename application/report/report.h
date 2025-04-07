#ifndef REPORT_H
#define REPORT_H

#include <stdbool.h>
#include <stdint.h>

// Regular reporting interval types
typedef enum {
    REGULAR_INTERVAL_FIXED_TIME = 0,  // Report at fixed time (HHMMSS)
    REGULAR_INTERVAL_EVERY_MINUTE = 1, // Report every minute
    REGULAR_INTERVAL_EVERY_QUARTER = 2, // Report every 15 minutes
    REGULAR_INTERVAL_EVERY_HOUR = 3,    // Report every hour
    REGULAR_INTERVAL_EVERY_DAY = 4      // Report every day
} regular_interval_type_t;

// Report configuration structure
typedef struct {
    bool enabled;                    // Enable/disable reporting
    uint8_t channel;                 // Reporting channel (0: MQTT, 1: HTTP, etc.)
    char mqtt_topic[128];           // MQTT topic for publishing
    uint8_t mqtt_qos;               // MQTT QoS level
    bool periodic_enabled;          // Enable periodic reporting
    uint32_t periodic_interval;     // Periodic reporting interval in seconds
    bool regular_enabled;           // Enable regular reporting
    regular_interval_type_t regular_interval_type; // Type of regular reporting interval
    uint32_t regular_fixed_time;    // Fixed time for regular reporting (HHMMSS format)
    bool failure_padding_enabled;   // Enable failure padding
    char failure_padding_content[256]; // Content for failure padding
    bool quotation_mark;            // Enable quotation marks for values
    char json_template[4096];       // JSON template for data formatting
    bool mqtt_data_query_set;       // Enable MQTT data query set
    uint8_t mqtt_query_set_type;    // MQTT query set type
    char mqtt_query_set_topic[128]; // MQTT query set topic
    uint8_t mqtt_query_set_qos;     // MQTT query set QoS
    char mqtt_respond_topic[128];   // MQTT respond topic
    uint8_t mqtt_respond_qos;       // MQTT respond QoS
    bool mqtt_retained_message;     // Enable MQTT retained message
} report_config_t;

// Function declarations
int report_init(void);
report_config_t* report_get_config(void);
bool report_is_enabled(void);

#endif
