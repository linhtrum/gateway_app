#include "websocket.h"
#include "mongoose.h"
#include <pthread.h>
#include <string.h>
#include <unistd.h>
#include "../database/db.h"
#include "../system/management.h"
#include "cJSON.h"

#define DBG_TAG "WEBSOCKET"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define DEFAULT_WS_PORT 4002
#define DEFAULT_WS_HOST "ws://0.0.0.0"

static struct mg_connection *ws_conn = NULL;

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
    char ws_url[64]; 

    int port = management_get_websocket_port();
    if (port == 0) {
        port = DEFAULT_WS_PORT;
    }
    snprintf(ws_url, sizeof(ws_url), "%s:%d", DEFAULT_WS_HOST, port);
    
    mg_mgr_init(&mgr);
    mg_http_listen(&mgr, ws_url, fn, NULL);
    mg_wakeup_init(&mgr);
    DBG_INFO("Websocket log server starting on %s", ws_url);
    
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






