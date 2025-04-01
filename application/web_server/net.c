#include "net.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <cJSON.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <linux/route.h>
#include <resolv.h>

#include "../database/db.h"
#include "../network/network.h"
#include "../log/log_buffer.h"
#include "../log/log_output.h"
#include "../modbus/device.h"
#include "../system/management.h"
#include "../event/event.h"
#include "../modbus/serial.h"
#include "../mqtt/mqtt.h"

#define DEFAULT_HTTP_PORT 8000
#define DEFAULT_HTTP_URL "http://0.0.0.0"

#define DBG_TAG "WEB"
#define DBG_LVL LOG_INFO
#include "dbg.h"

struct user {
  const char *name, *pass, *access_token;
};

static struct thread_data *t_data = NULL;

struct thread_data *get_thread_data(void) {
    return t_data;
}

static struct mg_connection *ws_conn = NULL;

static const char *s_json_header =
    "Content-Type: application/json\r\n"
    "Cache-Control: no-cache\r\n";

static char* generate_token(const char* username, const char* password) {
    // Allocate buffer for combined string (username + password + null terminator)
    size_t len = strlen(username) + strlen(password) + 1;
    char* combined = (char*)calloc(1, len);
    if (!combined) {
        DBG_ERROR("Failed to allocate memory for token generation");
        return NULL;
    }

    // Combine username and password
    snprintf(combined, len, "%s%s", username, password);

    // Simple hash function
    unsigned long hash = 5381;
    int c;
    char* str = combined;
    while ((c = *str++)) {
        hash = ((hash << 5) + hash) + c; // hash * 33 + c
    }

    // Convert hash to string token
    char* token = (char*)calloc(1, 17); // 16 chars + null terminator
    if (!token) {
        free(combined);
        DBG_ERROR("Failed to allocate memory for token");
        return NULL;
    }
    snprintf(token, 17, "%016lx", hash);

    free(combined);
    return token;
}

static struct user* get_user_from_db(void) {
    static struct user db_user;
    static char username[64] = {0};
    static char password[64] = {0};
    static char token[64] = {0};
    
    // Read username and password from database
    int username_len = db_read("username", username, sizeof(username));
    int password_len = db_read("password", password, sizeof(password));
    if (username_len <= 0 || password_len <= 0) {
        DBG_ERROR("Failed to read user credentials from database");
        return NULL;
    }

    // Generate access token if needed
    int token_len = db_read("access_token", token, sizeof(token));
    if (token_len <= 0) {
        char* new_token = generate_token(username, password);
        if (!new_token) {
            DBG_ERROR("Failed to generate access token");
            return NULL;
        }
        strncpy(token, new_token, sizeof(token)-1);
        free(new_token);
        
        // Store token in database
        if (db_write("access_token", token, strlen(token)+1) != 0) {
            DBG_ERROR("Failed to store access token in database");
            return NULL;
        }
    }

    // Set up user struct with database values
    db_user.name = username;
    db_user.pass = password; 
    db_user.access_token = token;

    return &db_user;
}

static struct user *authenticate(struct mg_http_message *hm) {
  // In production, make passwords strong and tokens randomly generated
  // In this example, user list is kept in RAM. In production, it can
  // be backed by file, database, or some other method.
  static struct user users[] = {
      {"admin", "admin", "admin_token"},
      {"user1", "user1", "user1_token"},
      {"user2", "user2", "user2_token"},
      {NULL, NULL, NULL},
  };
  char user[64], pass[64];
  struct user *u, *result = NULL;
  mg_http_creds(hm, user, sizeof(user), pass, sizeof(pass));
  MG_VERBOSE(("user [%s] pass [%s]", user, pass));

  if (user[0] != '\0' && pass[0] != '\0') {
    // Both user and password is set, search by user/password
    for (u = users; result == NULL && u->name != NULL; u++)
      if (strcmp(user, u->name) == 0 && strcmp(pass, u->pass) == 0) result = u;
  } else if (user[0] == '\0') {
    // Only password is set, search by token
    for (u = users; result == NULL && u->name != NULL; u++)
      if (strcmp(pass, u->access_token) == 0) result = u;
  }
  return result;
}

static void handle_login(struct mg_connection *c, struct user *u) {
  char cookie[256];
  const char *cookie_name = c->is_tls ? "secure_access_token" : "access_token";
  mg_snprintf(cookie, sizeof(cookie),
              "Set-Cookie: %s=%s; Path=/; "
              "%sHttpOnly; SameSite=Lax; Max-Age=%d\r\n",
              cookie_name, u->access_token,
              c->is_tls ? "Secure; " : "", 3600 * 24);
  mg_http_reply(c, 200, cookie, "{%m:%m}", MG_ESC("user"), MG_ESC(u->name));
}

static void handle_logout(struct mg_connection *c) {
  char cookie[256];
  const char *cookie_name = c->is_tls ? "secure_access_token" : "access_token";
  mg_snprintf(cookie, sizeof(cookie),
              "Set-Cookie: %s=; Path=/; "
              "Expires=Thu, 01 Jan 1970 00:00:00 UTC; "
              "%sHttpOnly; Max-Age=0; \r\n", cookie_name,
              c->is_tls ? "Secure; " : "");
  mg_http_reply(c, 200, cookie, "true\n");
}

static bool write_card_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    // Write card config to database
    int result = db_write("card_config", (void*)json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write card config to database");
        return false;
    }

    DBG_INFO("Card config written to database successfully");
    return true;
}

static char* read_card_config(void) {
    char *json_str = NULL;
    size_t buf_size = 8*4096;  // Initial buffer size
    
    // Allocate initial buffer
    json_str = calloc(1, buf_size);
    if (!json_str) {
        DBG_ERROR("Failed to allocate memory for card config");
        return NULL;
    }

    // Read card config from database
    int read_len = db_read("card_config", json_str, buf_size);
    if (read_len <= 0) {
        DBG_ERROR("Failed to read card config from database");
        free(json_str);
        return NULL;
    }

    DBG_INFO("Card config read from database successfully");
    return json_str;
}

// Get device configuration
static void handle_devices_get(struct mg_connection *c) {
    char config_str[8*4096] = {0};
    int read_len = db_read("device_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read device config from database");
    mg_http_reply(c, 200, s_json_header, "%s", "[]");
        return;
}
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

// Get system configuration
static void handle_system_get(struct mg_connection *c) {
    char config_str[4096] = {0};
    int read_len = db_read("system_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read system config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "{}");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

// Get network configuration
static void handle_network_get(struct mg_connection *c) {
    char *config_str = network_config_to_json();
    if (!config_str) {
        DBG_ERROR("Failed to read network config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "{}");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
    free(config_str);
}

// Set network configuration
static void handle_network_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("network_config", (void*)json_str, strlen(json_str) + 1);
    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to save network config\"}");
    }
    free(json_str);
}

// Set system configuration
static void handle_system_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("system_config", (void*)json_str, strlen(json_str) + 1);
    
    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply system configuration\"}");
    }
    free(json_str);
}

// Set device configuration
static void handle_devices_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("device_config", (void*)json_str, strlen(json_str) + 1);
    free(json_str);
    
    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply device configuration\"}");
    }
}

static void handle_card_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("card_config", (void*)json_str, strlen(json_str) + 1);
    free(json_str);
    
    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply card configuration\"}");
    }
}

static void handle_card_get(struct mg_connection *c) {
    char config_str[8*4096] = {0};
    int read_len = db_read("card_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read card config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "[]");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

static void handle_reboot_set(struct mg_connection *c, struct mg_http_message *hm) {
    DBG_INFO("Reboot requested");
    
    // Send success response first
    mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    
    // Schedule application restart with correct service name
    system("sleep 1 && systemctl restart myapp.service");
}

static void handle_factory_reset_set(struct mg_connection *c, struct mg_http_message *hm) {
    DBG_INFO("Factory reset");
    db_clear();
    mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
}

// Get event configuration
static void handle_event_get(struct mg_connection *c) {
    char config_str[4*4096] = {0};
    int read_len = db_read("event_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read event config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "[]");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

// Set event configuration
static void handle_event_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("event_config", (void*)json_str, strlen(json_str) + 1);
    
    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply event configuration\"}");
    }
    free(json_str);
}

static void handle_serial_get(struct mg_connection *c, int index) {
    char config_str[4096] = {0};
    int read_len = 0;
    if (index == 0) {
        read_len = db_read("serial1_config", config_str, sizeof(config_str));
    } else {
        read_len = db_read("serial2_config", config_str, sizeof(config_str));
    }
    if (read_len <= 0) {
        DBG_ERROR("Failed to read serial config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "{}");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

static void handle_serial_set(struct mg_connection *c, struct mg_http_message *hm, int index) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';
    int result = 0;

    if (index == 0) {
        result = db_write("serial1_config", (void*)json_str, strlen(json_str) + 1);
    } else {
        result = db_write("serial2_config", (void*)json_str, strlen(json_str) + 1);
    }
    free(json_str);

    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply serial configuration\"}");
    }
}

// Get MQTT configuration
static void handle_mqtt_get(struct mg_connection *c) {
    char config_str[4096] = {0};
    int read_len = db_read("mqtt_config", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read mqtt config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "{}");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

// Set MQTT configuration
static void handle_mqtt_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("mqtt_config", (void*)json_str, strlen(json_str) + 1);
    free(json_str);

    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply mqtt configuration\"}");
    }
}

static void handle_publish_get(struct mg_connection *c) {
    char config_str[4096] = {0};
    int read_len = db_read("publish_topics", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read publish config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "[]");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

static void handle_publish_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);   
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("publish_topics", (void*)json_str, strlen(json_str) + 1);
    free(json_str);

    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply publish configuration\"}");
    }
}

static void handle_subscribe_get(struct mg_connection *c) {
    char config_str[4096] = {0};
    int read_len = db_read("subscribe_topics", config_str, sizeof(config_str));
    if (read_len <= 0) {
        DBG_ERROR("Failed to read subscribe config from database");
        mg_http_reply(c, 200, s_json_header, "%s", "[]");
        return;
    }
    mg_http_reply(c, 200, s_json_header, "%s", config_str);
}

static void handle_subscribe_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("subscribe_topics", (void*)json_str, strlen(json_str) + 1);
    free(json_str);

    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply subscribe configuration\"}");
    }
}

static void handle_report_get(struct mg_connection *c) {
    // char config_str[4096] = {0};
    // int read_len = db_read("report_config", config_str, sizeof(config_str));
    // if (read_len <= 0) {
    //     DBG_ERROR("Failed to read report config from database");    
    //     mg_http_reply(c, 200, s_json_header, "%s", "[]");
    //     return;
    // }
    // mg_http_reply(c, 200, s_json_header, "%s", config_str);
    mg_http_reply(c, 200, s_json_header, "%s", "{}");
}

static void handle_report_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    // bool success = report_save_config_from_json(json_str);
    int result = db_write("report_config", (void*)json_str, strlen(json_str) + 1);
    free(json_str);
    
    if (result == 0) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply report configuration\"}");
    }
}

// Function to send message to all connected websocket clients
void send_websocket_message(const char *message) {
    if (!message || !ws_conn) return;
    
    mg_wakeup(ws_conn->mgr, ws_conn->id, message, strlen(message));
}

static void fn(struct mg_connection *c, int ev, void *ev_data) {
    if(ev == MG_EV_OPEN && c->is_listening) {
        DBG_INFO("Connection opened");
        ws_conn = c;
    }
    else if(ev == MG_EV_ACCEPT) {
        DBG_INFO("Connection accepted");
    }
    else if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *) ev_data;
        struct user *u = authenticate(hm);
        if (mg_match(hm->uri, mg_str("/api/#"), NULL) && u == NULL) {
            mg_http_reply(c, 403, "", "Not Authorised\n");
        }
        else if (mg_match(hm->uri, mg_str("/api/login"), NULL)) {
            DBG_INFO("Login");
            handle_login(c, u);
        }
        else if (mg_match(hm->uri, mg_str("/api/logout"), NULL)) {
            DBG_INFO("Logout");
            handle_logout(c);
        }
        else if (mg_match(hm->uri, mg_str("/websocket"), NULL)) {
            mg_ws_upgrade(c, hm, NULL);
            c->data[0] = 'W';
        }
        else if (mg_match(hm->uri, mg_str("/api/devices/get"), NULL)) {
            handle_devices_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/devices/set"), NULL)) {
            handle_devices_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/home/get"), NULL)) {
            handle_card_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/home/set"), NULL)) {
            handle_card_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/system/get"), NULL)) {
            handle_system_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/system/set"), NULL)) {
            handle_system_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/network/get"), NULL)) {
            handle_network_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/network/set"), NULL)) {
            handle_network_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/event/get"), NULL)) {
            handle_event_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/event/set"), NULL)) {
            handle_event_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/reboot/set"), NULL)) {
            handle_reboot_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/factory/set"), NULL)) {
            handle_factory_reset_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/serial/get"), NULL)) {
            handle_serial_get(c, 0);
        }
        else if (mg_match(hm->uri, mg_str("/api/serial/set"), NULL)) {
            handle_serial_set(c, hm, 0);
        }
        else if (mg_match(hm->uri, mg_str("/api/serial2/get"), NULL)) {
            handle_serial_get(c, 1);
        }
        else if (mg_match(hm->uri, mg_str("/api/serial2/set"), NULL)) {
            handle_serial_set(c, hm, 1);
        }
        else if (mg_match(hm->uri, mg_str("/api/mqtt/get"), NULL)) {
            handle_mqtt_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/mqtt/set"), NULL)) {
            handle_mqtt_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/publish/get"), NULL)) {
            handle_publish_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/publish/set"), NULL)) {
            handle_publish_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/subscribe/get"), NULL)) {
            handle_subscribe_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/subscribe/set"), NULL)) {
            handle_subscribe_set(c, hm);
        }
        else if (mg_match(hm->uri, mg_str("/api/report/get"), NULL)) {
            handle_report_get(c);
        }
        else if (mg_match(hm->uri, mg_str("/api/report/set"), NULL)) {
            handle_report_set(c, hm);
        }
        else {
            struct mg_http_serve_opts opts;
            memset(&opts, 0, sizeof(opts));
            opts.root_dir = "/web_root";
            opts.fs = &mg_fs_packed;
            mg_http_serve_dir(c, ev_data, &opts);
        }
    }
    else if (ev == MG_EV_WS_MSG) {
        struct mg_ws_message *wm = (struct mg_ws_message *) ev_data;
        mg_ws_send(c, wm->data.buf, wm->data.len, WEBSOCKET_OP_TEXT);
    }
    else if (ev == MG_EV_WAKEUP) {
        struct mg_str *data = (struct mg_str *) ev_data;
        // Broadcast message to all connected websocket clients
        for (struct mg_connection *wc = c->mgr->conns; wc != NULL; wc = wc->next) {
            if (wc->data[0] == 'W') {
                mg_ws_send(wc, data->buf, data->len, WEBSOCKET_OP_TEXT);
            }
        }
    }
}

static void *webserver_thread(void *arg) {
    struct mg_mgr mgr;
    char listen_url[128];
    int http_port;

    // Get HTTP configuration from system config
    http_port = management_get_http_port();
    if (http_port == 0) {
        DBG_ERROR("Failed to get HTTP config, using defaults");
        http_port = DEFAULT_HTTP_PORT;
    }
    
    mg_mgr_init(&mgr);
    snprintf(listen_url, sizeof(listen_url), "%s:%d", DEFAULT_HTTP_URL, http_port);
    mg_http_listen(&mgr, listen_url, fn, NULL);
    mg_wakeup_init(&mgr);
    DBG_INFO("Web server starting on %s", listen_url);

    while(1) {
        mg_mgr_poll(&mgr, 500);
        usleep(20 * 1000);
    }
    mg_mgr_free(&mgr);
    return NULL;
}

void web_init(void) {
    pthread_t thread;
    pthread_attr_t attr;
    
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    
    int ret = pthread_create(&thread, &attr, webserver_thread, NULL);
    if (ret != 0) {
        DBG_ERROR("Failed to create webserver thread: %s", strerror(ret));
    }
    
    pthread_attr_destroy(&attr);
}

