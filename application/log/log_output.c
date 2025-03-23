#include "log_output.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "serial.h"
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <pthread.h>
#include "dbg.h"  // For log level definitions
#include "net.h"
// Static buffers to avoid stack allocations
static char g_time_str[20];
static char g_output_buffer[LOG_BUFFER_SIZE];
static pthread_mutex_t g_output_mutex = PTHREAD_MUTEX_INITIALIZER;

static uint32_t g_output_types = LOG_OUTPUT_STDOUT;  // Always enable stdout by default
static int g_serial_fd = -1;

// Log level strings - using array for O(1) lookup
static const char* const level_strings[] = {
    [LOG_ERROR] = "ERROR",
    [LOG_WARN]  = "WARN",
    [LOG_INFO]  = "INFO",
    [LOG_DEBUG] = "DEBUG"
};

// Optimized timestamp formatting
static void format_timestamp(time_t timestamp) {
    struct tm* tm_info = localtime(&timestamp);
    strftime(g_time_str, sizeof(g_time_str), "%Y-%m-%d %H:%M:%S", tm_info);
}

// Optimized filename extraction
static const char* get_filename(const char* filepath) {
    const char* filename = strrchr(filepath, '/');
    return filename ? filename + 1 : filepath;
}

void log_output_init(uint32_t output_types) {
    pthread_mutex_lock(&g_output_mutex);
    
    // Always enable stdout
    g_output_types = LOG_OUTPUT_STDOUT;
    
    // Add additional outputs
    if (output_types & LOG_OUTPUT_SERIAL) {
        g_serial_fd = serial_open("/dev/ttyUSB0", 115200);
        if (g_serial_fd >= 0) {
            g_output_types |= LOG_OUTPUT_SERIAL;
        }
    }
    
    if (output_types & LOG_OUTPUT_WEBSOCKET) {
        g_output_types |= LOG_OUTPUT_WEBSOCKET;
    }
    
    pthread_mutex_unlock(&g_output_mutex);
}

void log_output_add(uint32_t type) {
    pthread_mutex_lock(&g_output_mutex);
    
    if (type == LOG_OUTPUT_SERIAL) {
        g_serial_fd = serial_open("/dev/ttyUSB0", 115200);
        if (g_serial_fd >= 0) {
            g_output_types |= type;
        }
    } else {
        g_output_types |= type;
    }
    
    pthread_mutex_unlock(&g_output_mutex);
}

void log_output_remove(uint32_t type) {
    pthread_mutex_lock(&g_output_mutex);
    
    if (type == LOG_OUTPUT_SERIAL && g_serial_fd >= 0) {
        serial_close(g_serial_fd);
        g_serial_fd = -1;
    }
    g_output_types &= ~type;
    
    pthread_mutex_unlock(&g_output_mutex);
}

void log_output_format_entry(const log_entry_t* entry, char* output, size_t output_size) {
    if (!entry || !output || output_size < LOG_BUFFER_SIZE) {
        return;
    }

    // Format timestamp once
    format_timestamp(entry->timestamp);
    
    // Get filename (optimized)
    const char* filename = get_filename(entry->file);
    
    // Format log entry with bounds checking
    int written = snprintf(output, output_size, 
        "[%s] [%s] [%s] [%s:%d] %s\n",
        g_time_str,
        level_strings[entry->level],
        entry->tag,
        filename,
        entry->line,
        entry->message);
        
    if (written < 0 || written >= output_size) {
        // Truncate message if buffer is too small
        output[output_size - 1] = '\n';
        output[output_size - 2] = '.';
        output[output_size - 3] = '.';
        output[output_size - 4] = '.';
    }
}

void log_output_process(void) {
    log_entry_t entry;
    
    while (log_buffer_get(&entry)) {
        // Format log entry using static buffer
        log_output_format_entry(&entry, g_output_buffer, sizeof(g_output_buffer));
        
        // Always output to stdout
        printf("%s", g_output_buffer);
        
        // Output to additional destinations with mutex protection
        pthread_mutex_lock(&g_output_mutex);
        
        if ((g_output_types & LOG_OUTPUT_SERIAL) && g_serial_fd >= 0) {
            // serial_write(g_serial_fd, g_output_buffer, strlen(g_output_buffer));
        }
        
        if (g_output_types & LOG_OUTPUT_WEBSOCKET) {
            // WebSocket output will be handled by the web server
            // This is just a placeholder for future implementation
            // Send log message to web thread for websocket broadcast
            struct thread_data *p = get_thread_data();
            if (p) {
                mg_wakeup(p->mgr, p->conn_id, g_output_buffer, strlen(g_output_buffer) - 1);
            }
        }
        
        pthread_mutex_unlock(&g_output_mutex);
    }
    
    // Sleep for 20ms to prevent busy-waiting
    usleep(20 * 1000);  // 20ms = 20,000 microseconds
}

static void *log_thread_func(void* arg) {
    while (1) {
        log_output_process();
    }
    return NULL;
}

void log_output_start(void) {
    pthread_t tid;
    pthread_create(&tid, NULL, log_thread_func, NULL);
    pthread_detach(tid);
}
