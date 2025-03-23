#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>
#include "web_server/net.h"
#include "modbus/rtu_master.h"
#include "database/db.h"
#include "log/log_buffer.h"
#include "log/log_output.h"

#define DBG_TAG "MAIN"
#define DBG_LVL LOG_INFO
#include "dbg.h"


int main(int argc, char *argv[]) {
    // Initialize database
    if (db_init() != 0) {
        printf("Failed to initialize database\n");
        return -1;
    }

    // Initialize logging system
    log_buffer_init();
    log_output_init(LOG_OUTPUT_WEBSOCKET);  // Enable stdout (default) and serial output

    // Start log processing thread
    log_output_start();

    // Initialize web server
    web_init();

    // Initialize Modbus RTU master
    // int serial_fd = rtu_master_init("/dev/ttyUSB0", 9600);
    // if (serial_fd < 0) {
    //     DBG_ERROR("Failed to initialize Modbus RTU master");
    //     return -1;
    // }

    // Get device configuration
    // device_t *device_config = get_device_config();
    // if (!device_config) {
    //     DBG_ERROR("Failed to get device configuration");
    //     return -1;
    // }

    DBG_INFO("Application started");

    // Main loop
    while (1) {
        // mg_mgr_poll(&mgr, 500);
        // rtu_master_poll(serial_fd, device_config);
        usleep(10 * 1000);  // 10ms delay
    }

    // // Cleanup (never reached in this example)
    // free_device_config(device_config);
    // mg_mgr_free(&mgr);
    return 0;
}
