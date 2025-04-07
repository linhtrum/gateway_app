#ifndef __REPORT_HANDLE_H__
#define __REPORT_HANDLE_H__

#include <stdint.h>
#include <stdbool.h>
#include <pthread.h>
#include "../modbus/device.h"
#include "../mqtt/mqtt.h"

// Report event queue structure
typedef struct {
    report_event_t *events;
    int capacity;
    int size;
    int front;
    int rear;
    pthread_mutex_t mutex;
    pthread_cond_t not_empty;
} report_queue_t;

// Report handle thread context
typedef struct {
    report_queue_t queue;
    bool running;
    pthread_t thread;
} report_handle_ctx_t;

// Function declarations
int report_handle_init(void);
void report_handle_start(void);
void report_handle_stop(void);
int report_handle_push_event(report_event_t *event);
void report_handle_cleanup(void);

#endif
