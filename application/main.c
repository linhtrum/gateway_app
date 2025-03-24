#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>
#include <signal.h>
#include "web_server/net.h"
#include "modbus/rtu_master.h"
#include "database/db.h"
#include "log/log_buffer.h"
#include "log/log_output.h"
#include "system/system.h"

#define DBG_TAG "MAIN"
#define DBG_LVL LOG_INFO
#include "dbg.h"

static void signal_handler(int signo) {
    DBG_INFO("Received signal %d, exiting...", signo);
    exit(0);
}

int main(int argc, char *argv[]) {
    // Initialize database
    if (db_init() != 0) {
        DBG_ERROR("Failed to initialize database");
        return -1;
    }

    // Initialize logging system
    log_buffer_init();
    // log_output_init(LOG_OUTPUT_WEBSOCKET);  // Enable stdout (default) and serial output

    // Setup signal handling
    signal(SIGTERM, signal_handler);
    signal(SIGINT, signal_handler);

    // Start log processing thread
    log_output_start();

    // Initialize web server
    web_init();

    // Initialize UDP server
    start_udp_server();

    // Initialize modbus master
    start_rtu_master();
    
    DBG_INFO("Application started");

    // Block on main thread (will be interrupted by signals)
    pause();

    return 0;
}
