#ifndef IO_FUNCTION_H
#define IO_FUNCTION_H

#include <stdint.h>
#include <stdbool.h>
#include "db.h"

// Timer action types
typedef enum {
    TIMER_ACTION_RESTART = 0, // Restart gateway
    TIMER_ACTION_DO,          // DO action
} timer_action_t;

// Timer DO action types
typedef enum {
    TIMER_DO_ACTION_NO = 0,   // Normally Open
    TIMER_DO_ACTION_NC,       // Normally Closed
    TIMER_DO_ACTION_FLIP,     // Flip state
} timer_do_action_t;

// Timer configuration
typedef struct {
    bool enabled;
    char time[9];  // HH:MM:SS format
    timer_action_t action;
    uint8_t do_action;      // 0: DO1, 1: DO2
    timer_do_action_t do_action_type;
} timer_config_t;

typedef enum {
    EXECUTE_ACTION_NO_ACTION = 0,
    EXECUTE_ACTION_OUTPUT_HOLD,
    EXECUTE_ACTION_OUTPUT_FLIP,
} execute_action_t;

// IO function configuration
typedef struct {
    uint8_t slave_address;
    timer_config_t timers[6];
    bool restart_hold;
    execute_action_t execute_action_do1;
    execute_action_t execute_action_do2;
    uint8_t execute_time_do1;
    uint8_t execute_time_do2;
    uint8_t filter_time;
} io_function_config_t;

// Initialize IO function configuration
void io_function_init(void);

// Parse IO function configuration from JSON string
bool io_function_parse_config(const char *json_str, io_function_config_t *config);

// Get current IO function configuration
bool io_function_get_config(io_function_config_t *config);

// Save IO function configuration to database
bool io_function_save_config(const io_function_config_t *config);

#endif // IO_FUNCTION_H
