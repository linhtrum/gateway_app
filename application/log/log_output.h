#ifndef LOG_OUTPUT_H
#define LOG_OUTPUT_H

#include <stdint.h>
#include <stddef.h>  // For size_t definition
#include "log_buffer.h"

// Output types (can be combined using bitwise OR)
#define LOG_OUTPUT_NONE     0x00
#define LOG_OUTPUT_STDOUT   0x01
#define LOG_OUTPUT_SERIAL   0x02
#define LOG_OUTPUT_WEBSOCKET 0x04

// Initialize log output system
void log_output_init(uint32_t output_types);

// Add output type
void log_output_add(uint32_t type);

// Remove output type
void log_output_remove(uint32_t type);

// Process and output buffered logs
void log_output_process(void);

// Format log entry into string
void log_output_format_entry(const log_entry_t* entry, char* output, size_t output_size);

// Start log output thread
void log_output_start(void);

// Get log method
int get_log_method(void);

#endif // LOG_OUTPUT_H 