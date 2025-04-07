#ifndef IO_FUNCTION_HANDLE_H
#define IO_FUNCTION_HANDLE_H

#include "io_function.h"
#include "io.h"
#include <stdbool.h>

// Timer state tracking
typedef struct {
    bool is_active;
    time_t trigger_time;
    bool previous_state;
} timer_state_t;

// Initialize timer handler
void io_function_handle_init(void);

// Get current relay state
bool io_control_get_relay_state(int relay_index);

#endif // IO_FUNCTION_HANDLE_H
