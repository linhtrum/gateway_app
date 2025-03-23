#include "log_buffer.h"
#include <string.h>
#include <time.h>
#include <pthread.h>
#include <stdbool.h>

// Log buffer structure
typedef struct {
    log_entry_t entries[LOG_BUFFER_COUNT];
    int head;
    int tail;
    int count;
    bool is_full;
} log_buffer_t;

static log_buffer_t g_log_buffer;
static pthread_mutex_t g_buffer_mutex = PTHREAD_MUTEX_INITIALIZER;

void log_buffer_init(void) {
    pthread_mutex_lock(&g_buffer_mutex);
    memset(&g_log_buffer, 0, sizeof(log_buffer_t));
    g_log_buffer.head = 0;
    g_log_buffer.tail = 0;
    g_log_buffer.count = 0;
    g_log_buffer.is_full = false;
    pthread_mutex_unlock(&g_buffer_mutex);
}

void log_buffer_add(const char* tag, log_level_t level, const char* message, const char* file, int line) {
    pthread_mutex_lock(&g_buffer_mutex);
    
    // Get current timestamp
    time_t now;
    time(&now);
    
    // Create new entry
    log_entry_t* entry = &g_log_buffer.entries[g_log_buffer.head];
    strncpy(entry->tag, tag, sizeof(entry->tag) - 1);
    entry->level = level;
    strncpy(entry->message, message, sizeof(entry->message) - 1);
    strncpy(entry->file, file, sizeof(entry->file) - 1);
    entry->line = line;
    entry->timestamp = now;
    
    // Update buffer indices
    g_log_buffer.head = (g_log_buffer.head + 1) % LOG_BUFFER_COUNT;
    if (g_log_buffer.count < LOG_BUFFER_COUNT) {
        g_log_buffer.count++;
    } else {
        g_log_buffer.is_full = true;
        g_log_buffer.tail = g_log_buffer.head;
    }
    
    pthread_mutex_unlock(&g_buffer_mutex);
}

int log_buffer_get(log_entry_t* entry) {
    int success = 0;
    
    pthread_mutex_lock(&g_buffer_mutex);
    
    if (g_log_buffer.count > 0) {
        // Copy entry to provided buffer
        memcpy(entry, &g_log_buffer.entries[g_log_buffer.tail], sizeof(log_entry_t));
        
        // Update buffer indices
        g_log_buffer.tail = (g_log_buffer.tail + 1) % LOG_BUFFER_COUNT;
        g_log_buffer.count--;
        g_log_buffer.is_full = false;
        
        success = 1;
    }
    
    pthread_mutex_unlock(&g_buffer_mutex);
    return success;
}

void log_buffer_clear(void) {
    pthread_mutex_lock(&g_buffer_mutex);
    memset(&g_log_buffer, 0, sizeof(log_buffer_t));
    g_log_buffer.head = 0;
    g_log_buffer.tail = 0;
    g_log_buffer.count = 0;
    g_log_buffer.is_full = false;
    pthread_mutex_unlock(&g_buffer_mutex);
}

int log_buffer_count(void) {
    int count;
    pthread_mutex_lock(&g_buffer_mutex);
    count = g_log_buffer.count;
    pthread_mutex_unlock(&g_buffer_mutex);
    return count;
} 