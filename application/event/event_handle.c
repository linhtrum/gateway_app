#include "event_handle.h"
#include <stdbool.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <errno.h>
#include <signal.h>
#include "cJSON.h"
#include "../modbus/rtu_master.h"
#include "event.h"


#define DBG_TAG "EVENT_HANDLE"
#define DBG_LVL LOG_INFO
#include "dbg.h"

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

// Timer handler function
static void timer_handler(union sigval sv) {
    event_data_t *event = (event_data_t *)sv.sival_ptr;
    if (!event || !event->enabled || !event->timer_active) return;

    // Get node value from RTU master
    float node_value = 0.0f;
    if (get_node_value(event->point, &node_value) == RTU_MASTER_OK) {
        // Check if event should trigger
        if (check_event_trigger(event, node_value)) {
            execute_event_action(event, node_value);
        }
    }
}

// Start monitoring for a specific event
static void start_event_monitor(event_data_t *event) {
    if (!event) {
        DBG_ERROR("Invalid event pointer");
        return;
    }

    if (!event->enabled) {
        DBG_INFO("Skipping disabled event: %s", event->name);
        return;
    }

    if (event->timer_active) {
        DBG_INFO("Event monitor already active for: %s", event->name);
        return;
    }

    struct sigevent sev;
    struct itimerspec its;
    
    // Set up the timer event
    sev.sigev_notify = SIGEV_THREAD;
    sev.sigev_notify_function = timer_handler;
    sev.sigev_value.sival_ptr = event;
    sev.sigev_notify_attributes = NULL;

    // Create the timer
    if (timer_create(CLOCK_MONOTONIC, &sev, &event->timer) == -1) {
        DBG_ERROR("Failed to create timer for event %s: %s", 
                 event->name, strerror(errno));
        return;
    }

    // Set the timer interval
    its.it_value.tv_sec = event->scan_cycle / 1000;
    its.it_value.tv_nsec = (event->scan_cycle % 1000) * 1000000;
    its.it_interval.tv_sec = event->scan_cycle / 1000;
    its.it_interval.tv_nsec = (event->scan_cycle % 1000) * 1000000;

    // Start the timer
    if (timer_settime(event->timer, 0, &its, NULL) == -1) {
        DBG_ERROR("Failed to start timer for event %s: %s", 
                 event->name, strerror(errno));
        timer_delete(event->timer);
        return;
    }

    event->timer_active = true;
    DBG_INFO("Event monitor timer started for event: %s (scan cycle: %dms)", 
             event->name, event->scan_cycle);
}

// Stop monitoring for a specific event
static void stop_event_monitor(event_data_t *event) {
    if (!event || !event->timer_active) return;

    event->timer_active = false;
    timer_delete(event->timer);
    DBG_INFO("Event monitor timer stopped for event: %s", event->name);
}

// Start monitoring all enabled events
void start_event_handle(void) {
    int enabled_count = 0;
    event_config_t *event_config = event_get_config();
    
    for (int i = 0; i < event_config->count; i++) {
        if (event_config->events[i].enabled) {
            start_event_monitor(&event_config->events[i]);
            enabled_count++;
        }
    }
    DBG_INFO("Started monitoring %d enabled events", enabled_count);
}

