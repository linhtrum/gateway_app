#include "event_handle.h"
#include <stdbool.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <errno.h>
#include <signal.h>
#include "cJSON.h"
#include "event.h"
#include <pthread.h>
#include <unistd.h>
#include "../modbus/rtu_master.h"

#define DBG_TAG "EVENT_HANDLE"
#define DBG_LVL LOG_INFO
#include "dbg.h"

static long long current_time_miliseconds(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static bool timer_expired(event_data_t *event) {
    return current_time_miliseconds() - event->last_scan_time >= event->scan_cycle;
}

// Function to check if a node value triggers an event
static bool check_event_trigger(event_data_t *event, float node_value) {
    if (!event || !event->enabled) return false;

    // Check if enough time has passed since last trigger
    time_t current_time = time(NULL);
    if (current_time - event->last_trigger < event->min_interval) {
        return false;
    }

    bool trigger = false;
    switch (event->condition) {
        case 1: // Forward follow (value increases)
            trigger = (node_value > 0);
            break;
        case 2: // Reverse follow (value decreases)
            trigger = (node_value <= 0);
            break;
        case 3: // Greater than or equal (>=)
            trigger = (node_value >= event->upper_threshold);
            break;
        case 4: // Less than or equal (<=)
            trigger = (node_value <= event->lower_threshold);
            break;
        case 5: // Within threshold (between lower and upper)
            trigger = (node_value >= event->lower_threshold && 
                      node_value <= event->upper_threshold);
            break;
        case 6: // Out of threshold (outside lower and upper)
            trigger = (node_value < event->lower_threshold || 
                      node_value > event->upper_threshold);
            break;
        case 7: // Greater than (>)
            trigger = (node_value > event->upper_threshold);
            break;
        case 8: // Less than (<)
            trigger = (node_value < event->lower_threshold);
            break;
        default:
        return false;
    }

    // Handle state change
    if (trigger != event->is_triggered) {
        event->is_triggered = trigger;
        event->last_trigger = current_time;
        event->last_value = node_value;
        return true;
    }

    return false;
}

// Function to execute event action
static void execute_event_action(event_data_t *event, float node_value) {
    if (!event) return;

    // Check if enough time has passed since last trigger
    time_t current_time = time(NULL);
    if (current_time - event->last_trigger < event->min_interval) {
        DBG_INFO("Skipping event action for %s: Min Trigger Interval not met", event->name);
        return;
    }

    DBG_INFO("Executing event action for event: %s (triggered: %d)", event->name, event->is_triggered);
    
    // Handle Forward and Reverse follow conditions
    if (event->condition == 1 || event->condition == 2) {
        if (event->is_triggered) {
            // Condition is satisfied - set relay based on follow logic
            if (event->condition == 1) {  // Forward follow
                if (node_value > 0) {
                    DBG_INFO("Setting relay %d to Normal Close state for Forward follow (value > 0)", 
                            event->trigger_exec);
                    // TODO: Implement relay control for Normal Close state
                } else {
                    DBG_INFO("Setting relay %d to Normal Open state for Forward follow (value <= 0)", 
                            event->trigger_exec);
                    // TODO: Implement relay control for Normal Open state
                }
            } else {  // Reverse follow
                if (node_value > 0) {
                    DBG_INFO("Setting relay %d to Normal Open state for Reverse follow (value > 0)", 
                            event->trigger_exec);
                    // TODO: Implement relay control for Normal Open state
                } else {
                    DBG_INFO("Setting relay %d to Normal Close state for Reverse follow (value <= 0)", 
                            event->trigger_exec);
                    // TODO: Implement relay control for Normal Close state
                }
            }
        } else {
            // Condition is no longer satisfied - return to initial state
            DBG_INFO("Returning relay %d to initial state (%s) for event: %s", 
                    event->trigger_exec, 
                    event->initial_state ? "Normal Close" : "Normal Open",
                    event->name);
            // TODO: Implement relay control for initial state
        }
        return;
    }
    
    // Handle other conditions (3-8)
    if (event->is_triggered) {
        // Condition is satisfied - execute trigger action
        switch (event->trigger_action) {
            case 1: // Normal Open (NO)
                DBG_INFO("Setting relay %d to Normal Open state for event: %s (value: %.2f)", 
                        event->trigger_exec, event->name, node_value);
                // TODO: Implement relay control for Normal Open state
                break;
            case 2: // Normal Close (NC)
                DBG_INFO("Setting relay %d to Normal Close state for event: %s (value: %.2f)", 
                        event->trigger_exec, event->name, node_value);
                // TODO: Implement relay control for Normal Close state
                break;
            case 3: // Flip (Toggle)
                DBG_INFO("Flipping relay %d state for event: %s (value: %.2f)", 
                        event->trigger_exec, event->name, node_value);
                // TODO: Implement relay control for Flip state
                break;
            default:
                DBG_ERROR("Unknown trigger action: %d", event->trigger_action);
                break;
        }
    } else {
        // Condition is no longer satisfied - return to initial state
        DBG_INFO("Returning relay %d to initial state (%s) for event: %s (value: %.2f)", 
                event->trigger_exec, 
                event->initial_state ? "Normal Close" : "Normal Open",
                event->name,
                node_value);
        // TODO: Implement relay control for initial state
    }

    // Update last trigger time after successful execution
    event->last_trigger = current_time;
}

// Event thread function
static void* event_thread_function(void *arg) {
    event_config_t *config = event_get_config();
    if (!config) {
        DBG_ERROR("Failed to get event configuration");
        return NULL;
    }

    DBG_INFO("Event handle thread started");

    // Main event loop
    while (1) {
        // Check each event
        for (int i = 0; i < config->count; i++) {
            event_data_t *event = &config->events[i];
            if (!event->enabled) {
                continue;
            }

            if(timer_expired(event)) {
                event->last_scan_time = current_time_miliseconds();
                float current_value = 0.0f;
                if (get_node_value(event->point, &current_value) == RTU_MASTER_OK) {
                    // Check if event should trigger
                    if (check_event_trigger(event, current_value)) {
                        execute_event_action(event, current_value);
                    }
                }
            }
        }
        usleep(10000); // Sleep for 10ms
    }

    return NULL;
}

void start_event_handle_thread(void) {
    pthread_t thread;
    pthread_attr_t attr;
    
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    
    int ret = pthread_create(&thread, &attr, event_thread_function, NULL);
    if (ret != 0) {
        DBG_ERROR("Failed to create event handle thread: %s", strerror(ret));
    }
    
    pthread_attr_destroy(&attr);
}
