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
#include "web_server/websocket.h"

#define DBG_TAG "MAIN"
#define DBG_LVL LOG_INFO
#include "dbg.h"

static volatile int running = 1;

static void signal_handler(int signo) {
    DBG_INFO("Received signal %d, initiating shutdown...", signo);
    running = 0;
}

int main(int argc, char *argv[]) {
    // Initialize database
    if (db_init() != 0) {
        DBG_ERROR("Failed to initialize database");
        return -1;
    }

    // Initialize logging system
    log_buffer_init();

    // Setup signal handling
    signal(SIGTERM, signal_handler);
    signal(SIGINT, signal_handler);
    signal(SIGHUP, signal_handler);

    // Start log processing thread
    log_output_start();

    // Apply network config
    apply_network_config();

    if(get_log_method() == 2) {
        log_output_init(LOG_OUTPUT_WEBSOCKET);
    }

    // Initialize web server
    web_init();

    // Initialize websocket log server
    websocket_log_start();

    // Initialize UDP server
    start_udp_server();

    // Initialize modbus master
    start_rtu_master();

    DBG_INFO("Application started");

    // Main service loop
    while (running) {
        sleep(1);
    }

    DBG_INFO("Application stopped");
    return 0;
}
