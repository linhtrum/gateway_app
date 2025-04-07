#ifndef IO_H
#define IO_H

#include "stdint.h"
#include "stdbool.h"
#include "agile_modbus.h"
#include "agile_modbus_slave_util.h"

extern const agile_modbus_slave_util_t slave_util;

// IO Control message types
typedef enum {
    IO_CONTROL_TYPE_RELAY,    // Control relay output
    IO_CONTROL_TYPE_READ_DI,  // Read digital input
    IO_CONTROL_TYPE_READ_AI,  // Read analog input
    IO_CONTROL_TYPE_GET_STATES, // Get all IO states
} io_control_type_t;

// IO Control message structure
typedef struct {
    io_control_type_t type;
    union {
        struct {
            uint8_t index;     // 0: DO1, 1: DO2
            bool state;        // true: ON, false: OFF
        } relay;
        struct {
            uint8_t index;     // 0: DI1, 1: DI2
            bool state;        // Current state
        } di;
        struct {
            uint8_t index;     // 0: AI1, 1: AI2
            uint16_t value;    // Current value (0-4095 for 12-bit ADC)
        } ai;
        struct {
            bool di_state[2];          // Digital input states
            bool relay_state[2];       // Relay output states
            uint16_t ai_value[2];      // Analog input values
        } states;
    };
} io_control_msg_t;

// IO Control context
typedef struct {
    bool running;
    pthread_t io_thread;      // Thread for IO operations
    pthread_t modbus_thread;  // Thread for Modbus slave
    pthread_mutex_t mutex;
    
    // IO states
    bool di_state[2];          // Digital input states
    bool relay_state[2];       // Relay output states
    uint16_t ai_value[2];      // Analog input values
    
    // Message queues
    io_control_msg_t io_queue[32];    // Queue for IO operations
    int io_queue_head;
    int io_queue_tail;
    pthread_mutex_t io_queue_mutex;
    
    io_control_msg_t modbus_queue[32]; // Queue for Modbus requests
    int modbus_queue_head;
    int modbus_queue_tail;
    pthread_mutex_t modbus_queue_mutex;
    
    // Modbus slave context
    agile_modbus_rtu_t ctx_rtu;
    uint8_t slave_addr;
    uint8_t send_buf[MODBUS_MAX_ADU_LENGTH];
    uint8_t recv_buf[MODBUS_MAX_ADU_LENGTH];
} io_control_ctx_t;

// Initialize IO control
int io_control_init(void);

// Start IO control threads
int io_control_start(void);

// Stop IO control threads
int io_control_stop(void);

// Send control message to IO thread
int io_control_send_msg(const io_control_msg_t *msg);

// Send request to Modbus thread
int io_modbus_send_request(const io_control_msg_t *msg);

// Get current IO states
void io_control_get_states(bool di_state[2], bool relay_state[2], uint16_t ai_value[2]);

#endif // IO_H