#ifndef DBG_H
#define DBG_H

#include <stdio.h>
#include <stdarg.h>
#include "log_types.h"
#include "log_buffer.h"

// Default log level if not defined
#ifndef DBG_LVL
#define DBG_LVL LOG_INFO
#endif

// Default tag if not defined
#ifndef DBG_TAG
#define DBG_TAG "APP"
#endif

// Log macro that checks level and adds message to buffer
#define LOG(level, fmt, ...) \
    do { \
        if (level <= DBG_LVL) { \
            char msg[LOG_BUFFER_SIZE]; \
            snprintf(msg, sizeof(msg), fmt, ##__VA_ARGS__); \
            log_buffer_add(DBG_TAG, level, msg, __FILE__, __LINE__); \
        } \
    } while(0)

// Convenience macros for different log levels
#define DBG_ERROR(fmt, ...) LOG(LOG_ERROR, fmt, ##__VA_ARGS__)
#define DBG_WARN(fmt, ...)  LOG(LOG_WARN, fmt, ##__VA_ARGS__)
#define DBG_INFO(fmt, ...)  LOG(LOG_INFO, fmt, ##__VA_ARGS__)
#define DBG_DEBUG(fmt, ...) LOG(LOG_DEBUG, fmt, ##__VA_ARGS__)

#endif // DBG_H
