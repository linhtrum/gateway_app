#include "io_function_handle.h"
#include "io_function.h"
#include "io.h"
#include "debug.h"
#include <pthread.h>
#include <time.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>

// Thread control
static pthread_t g_timer_thread;
static pthread_mutex_t g_timer_mutex = PTHREAD_MUTEX_INITIALIZER;

// Timer state tracking
static timer_state_t g_timer_states[6] = {0};

// Convert time string (HH:MM:SS) to seconds since midnight
static int time_string_to_seconds(const char *time_str) {
    int hours, minutes, seconds;
    if (sscanf(time_str, "%d:%d:%d", &hours, &minutes, &seconds) != 3) {
        return -1;
    }
    return hours * 3600 + minutes * 60 + seconds;
}

// Get current time in seconds since midnight
static int get_current_time_seconds(void) {
    time_t now;
    struct tm *tm_info;
    
    time(&now);
    tm_info = localtime(&now);
    
    return tm_info->tm_hour * 3600 + tm_info->tm_min * 60 + tm_info->tm_sec;
}

// Get current relay state
bool io_control_get_relay_state(int relay_index) {
    // TODO: Implement relay state retrieval
    return false;
}

// Process timer actions
static void process_timer_action(const timer_config_t *timer, int timer_index) {
    if (!timer->enabled) {
        return;
    }
    
    int timer_seconds = time_string_to_seconds(timer->time);
    if (timer_seconds < 0) {
        DBG_ERROR("Invalid timer time format: %s", timer->time);
        return;
    }
    
    int current_seconds = get_current_time_seconds();
    time_t current_time = time(NULL);
    
    // Check if timer is active and needs to be updated
    if (g_timer_states[timer_index].is_active) {
        time_t elapsed = current_time - g_timer_states[timer_index].trigger_time;
        uint8_t execute_time = (timer->do_action == 1) ? 
            io_function_get_config()->execute_time_do1 : 
            io_function_get_config()->execute_time_do2;
            
        execute_action_t execute_action = (timer->do_action == 1) ? 
            io_function_get_config()->execute_action_do1 : 
            io_function_get_config()->execute_action_do2;
            
        if (execute_action == EXECUTE_ACTION_OUTPUT_HOLD) {
            if (elapsed >= execute_time) {
                // Time to reset the state
                io_control_msg_t reset_msg = {
                    .type = IO_CONTROL_TYPE_RELAY_CONTROL,
                    .relay_control = {
                        .relay = timer->do_action - 1,
                        .state = g_timer_states[timer_index].previous_state
                    }
                };
                
                if (!io_control_send_msg(&reset_msg)) {
                    DBG_ERROR("Failed to reset DO state");
                }
                
                g_timer_states[timer_index].is_active = false;
                return;
            }
        } else if (execute_action == EXECUTE_ACTION_OUTPUT_FLIP) {
            // Check if it's time to flip
            if (elapsed >= execute_time) {
                // Get current state
                bool current_state = false;
                if (timer->do_action == 1) {
                    current_state = io_control_get_relay_state(0);
                } else if (timer->do_action == 2) {
                    current_state = io_control_get_relay_state(1);
                }
                
                // Flip the state
                io_control_msg_t flip_msg = {
                    .type = IO_CONTROL_TYPE_RELAY_CONTROL,
                    .relay_control = {
                        .relay = timer->do_action - 1,
                        .state = !current_state
                    }
                };
                
                if (!io_control_send_msg(&flip_msg)) {
                    DBG_ERROR("Failed to flip DO state");
                }
                
                // Update trigger time for next flip
                g_timer_states[timer_index].trigger_time = current_time;
            }
        }
    }
    
    // Check if current time matches timer time (within 1 second)
    if (abs(current_seconds - timer_seconds) <= 1) {
        switch (timer->action) {
            case TIMER_ACTION_RESTART:
                DBG_INFO("Timer triggered: Restarting gateway");
                // TODO: Implement gateway restart
                break;
                
            case TIMER_ACTION_DO:
                DBG_INFO("Timer triggered: DO action for DO%d", timer->do_action);
                
                // Get current relay state
                bool current_state = false;
                if (timer->do_action == 1) {
                    current_state = io_control_get_relay_state(0);
                } else if (timer->do_action == 2) {
                    current_state = io_control_get_relay_state(1);
                }
                
                // Store previous state if not already active
                if (!g_timer_states[timer_index].is_active) {
                    g_timer_states[timer_index].previous_state = current_state;
                }
                
                // Determine new state based on action type
                bool new_state = current_state;
                switch (timer->do_action_type) {
                    case TIMER_DO_ACTION_NO:
                        new_state = true;  // Normally Open
                        break;
                    case TIMER_DO_ACTION_NC:
                        new_state = false; // Normally Closed
                        break;
                    case TIMER_DO_ACTION_FLIP:
                        new_state = !current_state; // Flip current state
                        break;
                    default:
                        DBG_ERROR("Unknown DO action type: %d", timer->do_action_type);
                        return;
                }
                
                // Create IO control message
                io_control_msg_t msg = {
                    .type = IO_CONTROL_TYPE_RELAY_CONTROL,
                    .relay_control = {
                        .relay = timer->do_action - 1, // Convert to 0-based index
                        .state = new_state
                    }
                };
                
                // Send control message to IO thread
                if (!io_control_send_msg(&msg)) {
                    DBG_ERROR("Failed to send DO control message");
                    return;
                }
                
                // Check execute action
                execute_action_t execute_action = (timer->do_action == 1) ? 
                    io_function_get_config()->execute_action_do1 : 
                    io_function_get_config()->execute_action_do2;
                
                if (execute_action == EXECUTE_ACTION_OUTPUT_HOLD || 
                    execute_action == EXECUTE_ACTION_OUTPUT_FLIP) {
                    g_timer_states[timer_index].is_active = true;
                    g_timer_states[timer_index].trigger_time = current_time;
                }
                break;
                
            default:
                DBG_ERROR("Unknown timer action: %d", timer->action);
                break;
        }
    }
}

// Timer thread function
static void *timer_thread_func(void *arg) {
    (void)arg;
    
    while (1) {
        pthread_mutex_lock(&g_timer_mutex);
        
        // Get current configuration
        io_function_config_t *config = io_function_get_config();
        
        // Process all timers
        for (int i = 0; i < 6; i++) {
            process_timer_action(&config->timers[i], i);
        }
        
        pthread_mutex_unlock(&g_timer_mutex);
        
        // Sleep for 1 second
        sleep(1);
    }
    
    return NULL;
}

// Initialize timer handler
void io_function_handle_init(void) {
    // Initialize mutex
    if (pthread_mutex_init(&g_timer_mutex, NULL) != 0) {
        DBG_ERROR("Failed to initialize timer mutex");
        return;
    }
    
    // Initialize timer states
    memset(g_timer_states, 0, sizeof(g_timer_states));
    
    // Create timer thread
    if (pthread_create(&g_timer_thread, NULL, timer_thread_func, NULL) != 0) {
        DBG_ERROR("Failed to create timer thread");
        return;
    }
    
    DBG_INFO("Timer handler initialized");
}
