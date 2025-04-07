#include "io.h"
#include "serial.h"
#include "debug.h"
#include <string.h>
#include <pthread.h>
#include <unistd.h>
#include "io_function.h"
// Static IO control context
static io_control_ctx_t g_io_ctx = {0};

static pthread_mutex_t g_io_mutex = PTHREAD_MUTEX_INITIALIZER;

static uint8_t g_relay_state[2] = {0, 0}; // 2 relay outputs
static uint8_t g_di_state[2] = {0, 0}; // 2 digital inputs
static uint16_t g_ai_value[4] = {0, 0, 0, 0}; // 2 analog inputs, float values

static int get_relay_map_buf(void *buf, int bufsz) {
    uint8_t *ptr = (uint8_t *)buf;
    pthread_mutex_lock(&g_io_mutex);
    for (int i = 0; i < sizeof(g_relay_state); i++) {
        ptr[i] = g_relay_state[i];
    }
    pthread_mutex_unlock(&g_io_mutex);
    return 0;
}

static int set_relay_map_buf(int index, int len, void *buf, int bufsz) {
    uint8_t *ptr = (uint8_t *)buf;
    pthread_mutex_lock(&g_io_mutex);
    for (int i = 0; i < len; i++) {
        g_relay_state[index + i] = ptr[index + i];
    }
    pthread_mutex_unlock(&g_io_mutex);
    return 0;
}

const agile_modbus_slave_util_map_t relay_bit_maps[1] = {
    .start_addr = 0,
    .end_addr = 1,
    .get = get_relay_map_buf,
    .set = set_relay_map_buf,
};

static int get_di_map_buf(void *buf, int bufsz) {
    uint8_t *ptr = (uint8_t *)buf;
    pthread_mutex_lock(&g_io_mutex);
    for (int i = 0; i < sizeof(g_di_state); i++) {
        ptr[i] = g_di_state[i];
    }
    pthread_mutex_unlock(&g_io_mutex);
    return 0;
}

const agile_modbus_slave_util_map_t di_bit_maps[1] = {
    .start_addr = 0,
    .end_addr = 1,
    .get = get_di_map_buf,
};

static int get_ai_map_buf(void *buf, int bufsz) {
    uint16_t *ptr = (uint16_t *)buf;
    pthread_mutex_lock(&g_io_mutex);
    for (int i = 0; i < sizeof(g_ai_value) / sizeof(g_ai_value[0]); i++) {
        ptr[i] = g_ai_value[i];
    }
    pthread_mutex_unlock(&g_io_mutex);
    return 0;
}

const agile_modbus_slave_util_map_t ai_register_maps[1] = {
    .start_addr = 0,
    .end_addr = 3,
    .get = get_ai_map_buf,
};

static int address_check(agile_modbus_t *ctx, struct agile_modbus_slave_info *info) {
    int slave_addr = info->sft->slave_addr;
    if((slave_addr != ctx->slave_addr) && (slave_addr != AGILE_MODBUS_BROADCAST_ADDRESS) && (slave_addr != 0xFF)) {
        return -AGILE_MODBUS_EXCEPTION_UNKNOW;
    }
    return 0;
}

const agile_modbus_slave_util_t slave_util = {
    // relay outputs
    .tab_bits = relay_bit_maps,
    .nb_bits = sizeof(relay_bit_maps) / sizeof(relay_bit_maps[0]),
    // digital inputs
    .tab_input_bits = di_bit_maps,
    .nb_input_bits = sizeof(di_bit_maps) / sizeof(di_bit_maps[0]),
    // analog inputs
    .tab_input_registers = ai_register_maps,
    .nb_input_registers = sizeof(ai_register_maps) / sizeof(ai_register_maps[0]),
    .tab_registers = NULL,
    .nb_registers = 0,
    // address check
    .address_check = address_check,
    .special_function = NULL,
    .done = NULL,
};

// read digital inputs
int io_control_read_digital_inputs(int index) {
    pthread_mutex_lock(&g_io_mutex);
    int value = g_di_state[index - 1];
    pthread_mutex_unlock(&g_io_mutex);
    return value;
}

// write relay outputs
int io_control_write_relay(int index, int state) {
    pthread_mutex_lock(&g_io_mutex);
    g_relay_state[index - 1] = state;
    pthread_mutex_unlock(&g_io_mutex);
    return 0;
}

// read analog inputs
float io_control_read_analog_inputs(int index) {
    pthread_mutex_lock(&g_io_mutex);
    float value = 0.0f;
    memcpy(&value, &g_ai_value[(index - 1) * 2], sizeof(float));
    pthread_mutex_unlock(&g_io_mutex);
    return value;
}

// IO thread function
static void* io_thread_func(void *arg) {
    (void)arg;
    
    while (1) {
        // read digital inputs
        // write relay outputs
        // read analog inputs
        
        // Sleep for a short time to prevent CPU hogging
        usleep(1000); // 1ms
    }
    
    return NULL;
}

// Modbus thread function
static void* modbus_thread_func(void *arg) {
    (void)arg;
    uint8_t slave_send_buf[MODBUS_MAX_ADU_LENGTH];
    uint8_t slave_recv_buf[MODBUS_MAX_ADU_LENGTH];

    agile_modbus_rtu_t ctx_rtu;
    agile_modbus_t *ctx = &ctx_rtu._ctx;

    agile_modbus_rtu_init(&ctx_rtu, slave_send_buf, sizeof(slave_send_buf), slave_recv_buf, sizeof(slave_recv_buf));
    io_function_config_t *io_function_config = io_function_get_config();
    if(io_function_config == NULL) {
        DBG_ERROR("Failed to get IO function configuration");
        return NULL;
    }
    
    agile_modbus_set_slave(ctx, io_function_config->slave_address);
    while(1) {
        // agile_modbus_poll(ctx);
        usleep(1000);
    }

}

// Initialize IO control
int io_control_init(void) {
    // Initialize mutexes
    if (pthread_mutex_init(&g_io_ctx.mutex, NULL) != 0 ||
        pthread_mutex_init(&g_io_ctx.io_queue_mutex, NULL) != 0 ||
        pthread_mutex_init(&g_io_ctx.modbus_queue_mutex, NULL) != 0) {
        DBG_ERROR("Failed to initialize IO control mutexes");
        return -1;
    }
    
    // Set Modbus slave address
    g_io_ctx.slave_addr = 1;  // Default slave address
    
    return 0;
}

// Start IO control threads
int io_control_start(void) {
    if (g_io_ctx.running) {
        return 0;
    }
    
    g_io_ctx.running = true;
    
    // Start IO thread
    if (pthread_create(&g_io_ctx.io_thread, NULL, io_thread_func, NULL) != 0) {
        DBG_ERROR("Failed to create IO thread");
        g_io_ctx.running = false;
        return -1;
    }
    
    // Start Modbus thread
    if (pthread_create(&g_io_ctx.modbus_thread, NULL, modbus_thread_func, NULL) != 0) {
        DBG_ERROR("Failed to create Modbus thread");
        g_io_ctx.running = false;
        pthread_join(g_io_ctx.io_thread, NULL);
        return -1;
    }
    
    return 0;
}

// Stop IO control threads
int io_control_stop(void) {
    if (!g_io_ctx.running) {
        return 0;
    }
    
    g_io_ctx.running = false;
    pthread_join(g_io_ctx.io_thread, NULL);
    pthread_join(g_io_ctx.modbus_thread, NULL);
    
    return 0;
}

// Send control message to IO thread
int io_control_send_msg(const io_control_msg_t *msg) {
    if (!msg) {
        return -1;
    }
    
    pthread_mutex_lock(&g_io_ctx.io_queue_mutex);
    
    // Check if queue is full
    int next_tail = (g_io_ctx.io_queue_tail + 1) % 32;
    if (next_tail == g_io_ctx.io_queue_head) {
        pthread_mutex_unlock(&g_io_ctx.io_queue_mutex);
        return -1;
    }
    
    // Add message to queue
    g_io_ctx.io_queue[g_io_ctx.io_queue_tail] = *msg;
    g_io_ctx.io_queue_tail = next_tail;
    
    pthread_mutex_unlock(&g_io_ctx.io_queue_mutex);
    return 0;
}

// Send request to Modbus thread
int io_modbus_send_request(const io_control_msg_t *msg) {
    if (!msg) {
        return -1;
    }
    
    pthread_mutex_lock(&g_io_ctx.modbus_queue_mutex);
    
    // Check if queue is full
    int next_tail = (g_io_ctx.modbus_queue_tail + 1) % 32;
    if (next_tail == g_io_ctx.modbus_queue_head) {
        pthread_mutex_unlock(&g_io_ctx.modbus_queue_mutex);
        return -1;
    }
    
    // Add message to queue
    g_io_ctx.modbus_queue[g_io_ctx.modbus_queue_tail] = *msg;
    g_io_ctx.modbus_queue_tail = next_tail;
    
    pthread_mutex_unlock(&g_io_ctx.modbus_queue_mutex);
    return 0;
}

// Get current IO states
void io_control_get_states(bool di_state[2], bool relay_state[2], uint16_t ai_value[2]) {
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_GET_STATES
    };
    
    // Send request to IO thread
    if (io_control_send_msg(&msg) == 0) {
        // Wait for response
        usleep(1000); // Small delay to allow processing
        
        pthread_mutex_lock(&g_io_ctx.mutex);
        if (di_state) {
            memcpy(di_state, g_io_ctx.di_state, sizeof(g_io_ctx.di_state));
        }
        if (relay_state) {
            memcpy(relay_state, g_io_ctx.relay_state, sizeof(g_io_ctx.relay_state));
        }
        if (ai_value) {
            memcpy(ai_value, g_io_ctx.ai_value, sizeof(g_io_ctx.ai_value));
        }
        pthread_mutex_unlock(&g_io_ctx.mutex);
    }
}

// Modbus slave function handlers
static int handle_read_coils(agile_modbus_t *ctx, int addr, int nb) {
    (void)ctx;
    
    // Check if address range is valid
    if (addr < 0 || addr + nb > 2) {
        return -1;
    }
    
    // Create request to get states
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_GET_STATES
    };
    
    // Send request to IO thread
    if (io_control_send_msg(&msg) != 0) {
        return -1;
    }
    
    // Wait for response
    usleep(1000); // Small delay to allow processing
    
    // Return relay states
    uint8_t data[2] = {0};
    pthread_mutex_lock(&g_io_ctx.mutex);
    for (int i = 0; i < nb; i++) {
        if (g_io_ctx.relay_state[addr + i]) {
            data[i / 8] |= (1 << (i % 8));
        }
    }
    pthread_mutex_unlock(&g_io_ctx.mutex);
    
    agile_modbus_slave_io_set(ctx, data, nb);
    return 0;
}

static int handle_read_discrete_inputs(agile_modbus_t *ctx, int addr, int nb) {
    (void)ctx;
    
    // Check if address range is valid
    if (addr < 0 || addr + nb > 2) {
        return -1;
    }
    
    // Create request to get states
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_GET_STATES
    };
    
    // Send request to IO thread
    if (io_control_send_msg(&msg) != 0) {
        return -1;
    }
    
    // Wait for response
    usleep(1000); // Small delay to allow processing
    
    // Return DI states
    uint8_t data[2] = {0};
    pthread_mutex_lock(&g_io_ctx.mutex);
    for (int i = 0; i < nb; i++) {
        if (g_io_ctx.di_state[addr + i]) {
            data[i / 8] |= (1 << (i % 8));
        }
    }
    pthread_mutex_unlock(&g_io_ctx.mutex);
    
    agile_modbus_slave_io_set(ctx, data, nb);
    return 0;
}

static int handle_read_holding_registers(agile_modbus_t *ctx, int addr, int nb) {
    (void)ctx;
    
    // Check if address range is valid
    if (addr < 0 || addr + nb > 2) {
        return -1;
    }
    
    // Create request to get states
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_GET_STATES
    };
    
    // Send request to IO thread
    if (io_control_send_msg(&msg) != 0) {
        return -1;
    }
    
    // Wait for response
    usleep(1000); // Small delay to allow processing
    
    // Return relay states as registers
    uint16_t data[2] = {0};
    pthread_mutex_lock(&g_io_ctx.mutex);
    for (int i = 0; i < nb; i++) {
        data[i] = g_io_ctx.relay_state[addr + i] ? 0xFF00 : 0x0000;
    }
    pthread_mutex_unlock(&g_io_ctx.mutex);
    
    agile_modbus_slave_io_set(ctx, (uint8_t*)data, nb * 2);
    return 0;
}

static int handle_read_input_registers(agile_modbus_t *ctx, int addr, int nb) {
    (void)ctx;
    
    // Check if address range is valid
    if (addr < 0 || addr + nb > 2) {
        return -1;
    }
    
    // Create request to get states
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_GET_STATES
    };
    
    // Send request to IO thread
    if (io_control_send_msg(&msg) != 0) {
        return -1;
    }
    
    // Wait for response
    usleep(1000); // Small delay to allow processing
    
    // Return AI values
    pthread_mutex_lock(&g_io_ctx.mutex);
    agile_modbus_slave_io_set(ctx, (uint8_t*)&g_io_ctx.ai_value[addr], nb * 2);
    pthread_mutex_unlock(&g_io_ctx.mutex);
    return 0;
}

static int handle_write_single_coil(agile_modbus_t *ctx, int addr, int status) {
    (void)ctx;
    
    // Check if address is valid
    if (addr < 0 || addr >= 2) {
        return -1;
    }
    
    // Create relay control message
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_RELAY,
        .relay = {
            .index = addr,
            .state = (status == 0xFF00)
        }
    };
    
    // Send request to IO thread
    return io_control_send_msg(&msg);
}

static int handle_write_single_register(agile_modbus_t *ctx, int addr, int value) {
    (void)ctx;
    
    // Check if address is valid
    if (addr < 0 || addr >= 2) {
        return -1;
    }
    
    // Create relay control message
    io_control_msg_t msg = {
        .type = IO_CONTROL_TYPE_RELAY,
        .relay = {
            .index = addr,
            .state = (value != 0)
        }
    };
    
    // Send request to IO thread
    return io_control_send_msg(&msg);
}

