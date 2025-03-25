#include "websocket.h"
#include "mongoose.h"
#include <pthread.h>
#include <string.h>
#include <unistd.h>
#include "db.h"
#include "cJSON.h"

#define DBG_TAG "WEBSOCKET"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define DEFAULT_WS_PORT 4002
#define DEFAULT_WS_HOST "ws://0.0.0.0"

static char s_listen_on[64];  // Buffer for complete websocket URL
static struct mg_connection *ws_conn = NULL;

// Get websocket port from database
static int get_websocket_port(void) {
    char json_str[1024] = {0};
    int port = DEFAULT_WS_PORT;  // Default port
    
    // Read JSON string from database
    int read_len = db_read("system_config", json_str, sizeof(json_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read system config from database");
        return port;  // Return default port
    }

    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse system config JSON");
        return port;  // Return default port
    }

    // Get wport value
    cJSON *port_obj = cJSON_GetObjectItem(root, "wport");
    if (port_obj && cJSON_IsNumber(port_obj)) {
        port = port_obj->valueint;
        DBG_INFO("Websocket port loaded: %d", port);
    } else {
        DBG_WARN("Websocket port not found in config, using default: %d", port);
    }

    cJSON_Delete(root);
    return port;
}

// Initialize websocket URL with port from config
static void init_websocket_url(void) {
    int port = get_websocket_port();
    snprintf(s_listen_on, sizeof(s_listen_on), "%s:%d", DEFAULT_WS_HOST, port);
    DBG_INFO("Websocket URL set to: %s", s_listen_on);
}

// Handle websocket connection
static void fn(struct mg_connection *c, int ev, void *ev_data) {
    if(ev == MG_EV_OPEN && c->is_listening) {
        DBG_INFO("Websocket connection opened");
        ws_conn = c;
    } else if(ev == MG_EV_HTTP_MSG) {
        DBG_INFO("Websocket HTTP message received");
        struct mg_http_message *hm = (struct mg_http_message *) ev_data;
        mg_ws_upgrade(c, hm, NULL);
        // c->data[0] = 'W';
    } else if(ev == MG_EV_WS_OPEN) {
        c->data[0] = 'W';
    } else if(ev == MG_EV_WS_MSG) {  
        struct mg_ws_message *wm = (struct mg_ws_message *) ev_data;
        DBG_INFO("Websocket message received: %.*s", (int)wm->data.len, wm->data.buf);
    } else if(ev == MG_EV_CLOSE) {
        if(c->is_listening) {
            DBG_INFO("Websocket connection closed");
            ws_conn = NULL;
        }
    } else if (ev == MG_EV_WAKEUP) {
        struct mg_str *data = (struct mg_str *) ev_data;
        // Broadcast message to all connected websocket clients
        for (struct mg_connection *wc = c->mgr->conns; wc != NULL; wc = wc->next) {
            if (wc->data[0] == 'W') {
                mg_ws_send(wc, data->buf, data->len, WEBSOCKET_OP_TEXT);
            }
        }
    }
}

void websocket_log_send(const char *message) {
    if(!ws_conn || !message) {
        DBG_ERROR("Websocket connection not opened");
        return;
    }
    mg_wakeup(ws_conn->mgr, ws_conn->id, message, strlen(message));
}

static void *websocket_log_thread(void *arg) {
    struct mg_mgr mgr;
    
    // Initialize websocket URL with port from config
    init_websocket_url();
    
    mg_mgr_init(&mgr);
    mg_http_listen(&mgr, s_listen_on, fn, NULL);
    mg_wakeup_init(&mgr);
    DBG_INFO("Websocket log server starting on %s", s_listen_on);
    
    while(1) {
        mg_mgr_poll(&mgr, 500);
        usleep(20 * 1000);
    }
    mg_mgr_free(&mgr);
    return NULL;
}

void websocket_log_start() {
    pthread_t thread;
    pthread_attr_t attr;
    
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    int ret = pthread_create(&thread, &attr, websocket_log_thread, NULL);
    if (ret != 0) {
        DBG_ERROR("Failed to create websocket log thread: %s", strerror(ret));
    }
    pthread_attr_destroy(&attr);
}






