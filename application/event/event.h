#ifndef EVENT_H
#define EVENT_H

#include <stdbool.h>
#include <string.h>
#include <time.h>

#define MAX_EVENTS 10

// Event data structure
typedef struct {
    char name[20];              // "n": Event Name - max 20 character
    bool enabled;               // "e": Enable Event
    int condition;              // "c": Trigger Condition
    char point[20];             // "p": Trigger Point (Node Name)
    int scan_cycle;             // "sc": Scanning Cycle
    int min_interval;           // "mi": Min Trigger Interval
    int upper_threshold;        // "ut": Upper Threshold value
    int lower_threshold;        // "lt": Lower Threshold
    int trigger_exec;           // "te": Trigger Execution
    int trigger_action;         // "ta": Trigger Action
    char description[128];      // "d": Event Description
    long id;                    // "id": Event id
    time_t last_trigger;        // Last trigger time
    long long last_scan_time;   // Last scan time
    float last_value;           // Last value for follow conditions
    timer_t timer;              // POSIX timer
    bool timer_active;          // Timer active flag
    bool is_triggered;          // Current trigger state
    int initial_state;          // Initial relay state (0: NO, 1: NC)
} event_data_t;

typedef struct {
    event_data_t events[MAX_EVENTS];
    int count;
    bool is_initialized;
} event_config_t;

void event_init(void);
void event_deinit(void);

bool event_save_config_from_json(const char *json_str);
char *event_config_to_json(void);

event_config_t* event_get_config(void);
int event_get_count(void);

#endif /* EVENT_H */