#ifndef LOG_BUFFER_H
#define LOG_BUFFER_H

#include <stdint.h>
#include <time.h>  // For time_t definition
#include "log_types.h"

#define LOG_BUFFER_SIZE 256
#define LOG_BUFFER_COUNT 1000

typedef struct {
    char tag[32];
    log_level_t level;
    char message[LOG_BUFFER_SIZE];
    char file[64];
    int line;
    time_t timestamp;
} log_entry_t;

// Initialize the log buffer
void log_buffer_init(void);

// Add a log entry to the buffer
void log_buffer_add(const char* tag, log_level_t level, const char* message, const char* file, int line);

// Get the next log entry from the buffer
int log_buffer_get(log_entry_t* entry);

#endif // LOG_BUFFER_H 