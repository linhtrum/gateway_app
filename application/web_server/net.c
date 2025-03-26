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
#include "db.h"
#include "../log/log_buffer.h"
#include "../log/log_output.h"

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

static char* get_network_info(void) {
    cJSON *root = cJSON_CreateObject();
    
    // Create socket for ioctl
    int sockfd = socket(AF_INET, SOCK_DGRAM, 0);
    if (sockfd < 0) {
        cJSON_AddStringToObject(root, "error", "Failed to create socket");
        char *json_str = cJSON_PrintUnformatted(root);
        cJSON_Delete(root);
        return json_str;
    }

    // Get network interfaces
    struct ifconf ifc;
    char buf[1024];
    ifc.ifc_len = sizeof(buf);
    ifc.ifc_buf = buf;
    
    if (ioctl(sockfd, SIOCGIFCONF, &ifc) < 0) {
        cJSON_AddStringToObject(root, "error", "Failed to get network interfaces");
        close(sockfd);
        char *json_str = cJSON_PrintUnformatted(root);
        cJSON_Delete(root);
        return json_str;
    }

    // Process each interface
    struct ifreq *ifr = ifc.ifc_req;
    int n = ifc.ifc_len / sizeof(struct ifreq);
    bool found_interface = false;
    
    for (int i = 0; i < n; i++) {
        struct ifreq *item = &ifr[i];
        
        // Only process eth0 interface
        if (strcmp(item->ifr_name, "eth0") != 0) {
            continue;
        }

        // Get interface flags
        if (ioctl(sockfd, SIOCGIFFLAGS, item) < 0) {
            cJSON_AddStringToObject(root, "error", "Failed to get eth0 interface flags");
            close(sockfd);
            char *json_str = cJSON_PrintUnformatted(root);
            cJSON_Delete(root);
            return json_str;
        }

        // Check if interface is up
        if (!(item->ifr_flags & IFF_UP)) {
            cJSON_AddStringToObject(root, "error", "eth0 interface is not up");
            close(sockfd);
            char *json_str = cJSON_PrintUnformatted(root);
            cJSON_Delete(root);
            return json_str;
        }

        // Get IP address
        struct sockaddr_in *addr = (struct sockaddr_in *)&item->ifr_addr;
        char ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &addr->sin_addr, ip, sizeof(ip));
        
        // Get netmask
        struct ifreq ifr_mask;
        strncpy(ifr_mask.ifr_name, item->ifr_name, IFNAMSIZ - 1);
        if (ioctl(sockfd, SIOCGIFNETMASK, &ifr_mask) == 0) {
            struct sockaddr_in *mask = (struct sockaddr_in *)&ifr_mask.ifr_netmask;
            char netmask[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &mask->sin_addr, netmask, sizeof(netmask));
            
            cJSON_AddStringToObject(root, "if", item->ifr_name);
            cJSON_AddStringToObject(root, "ip", ip);
            cJSON_AddStringToObject(root, "sm", netmask);
            found_interface = true;
        } else {
            cJSON_AddStringToObject(root, "error", "Failed to get eth0 netmask");
            close(sockfd);
            char *json_str = cJSON_PrintUnformatted(root);
            cJSON_Delete(root);
            return json_str;
        }
        break; // We found eth0, no need to continue
    }

    if (!found_interface) {
        cJSON_AddStringToObject(root, "error", "eth0 interface not found");
        close(sockfd);
        char *json_str = cJSON_PrintUnformatted(root);
        cJSON_Delete(root);
        return json_str;
    }

    // Get default gateway
    struct rtentry rt;
    memset(&rt, 0, sizeof(rt));
    struct sockaddr_in *addr = (struct sockaddr_in *)&rt.rt_gateway;
    addr->sin_family = AF_INET;
    
    bool found_gateway = false;
    if (ioctl(sockfd, SIOCDELRT, &rt) < 0) {
        // Try to get default gateway from /proc/net/route
        FILE *fp = fopen("/proc/net/route", "r");
        if (fp) {
            char line[256];
            // Skip header line
            fgets(line, sizeof(line), fp);
            
            while (fgets(line, sizeof(line), fp)) {
                char iface[16];
                unsigned long dest, gateway, flags;
                if (sscanf(line, "%s %lx %lx %lx", iface, &dest, &gateway, &flags) == 4) {
                    if (dest == 0 && (flags & RTF_GATEWAY) && strcmp(iface, "eth0") == 0) {
                        struct in_addr addr;
                        addr.s_addr = gateway;
                        char gateway_str[INET_ADDRSTRLEN];
                        inet_ntop(AF_INET, &addr, gateway_str, sizeof(gateway_str));
                        cJSON_AddStringToObject(root, "gw", gateway_str);
                        found_gateway = true;
                        break;
                    }
                }
            }
            fclose(fp);
        }
    }

    if (!found_gateway) {
        cJSON_AddStringToObject(root, "gw", "");
    }

    // Get DNS servers from /etc/resolv.conf
    bool found_dns = false;
    FILE *resolv_fp = fopen("/etc/resolv.conf", "r");
    if (resolv_fp) {
        char line[256];
        char dns1[INET_ADDRSTRLEN] = "";
        char dns2[INET_ADDRSTRLEN] = "";
        
        while (fgets(line, sizeof(line), resolv_fp)) {
            // Remove trailing whitespace
            line[strcspn(line, "\r\n")] = 0;
            
            // Look for nameserver entries
            if (strncmp(line, "nameserver", 10) == 0) {
                char *dns = line + 10;  // Skip "nameserver"
                // Skip leading whitespace
                while (*dns == ' ') dns++;
                
                if (!found_dns) {
                    // First DNS server
                    strncpy(dns1, dns, sizeof(dns1) - 1);
                    found_dns = true;
                } else {
                    // Second DNS server
                    strncpy(dns2, dns, sizeof(dns2) - 1);
                    break;  // We only need two DNS servers
                }
            }
        }
        fclose(resolv_fp);
        
        // Add DNS servers to JSON
        cJSON_AddStringToObject(root, "d1", dns1);
        cJSON_AddStringToObject(root, "d2", dns2);
    } else {
        // If can't read resolv.conf, add empty DNS servers
        cJSON_AddStringToObject(root, "d1", "");
        cJSON_AddStringToObject(root, "d2", "");
    }

    // Check if DHCP is enabled by looking at systemd network configuration
    bool dhcp_enabled = false;
    FILE *network_fp = fopen("/lib/systemd/network/80-wired.network", "r");
    if (network_fp) {
        char line[256];
        bool in_network_section = false;
        while (fgets(line, sizeof(line), network_fp)) {
            // Remove trailing whitespace
            line[strcspn(line, "\r\n")] = 0;
            
            // Check for [Network] section
            if (strcmp(line, "[Network]") == 0) {
                in_network_section = true;
            } else if (line[0] == '[' && line[strlen(line)-1] == ']') {
                in_network_section = false;
            }
            
            // In [Network] section, only enable DHCP if exactly "DHCP=yes"
            if (in_network_section && strcmp(line, "DHCP=yes") == 0) {
                dhcp_enabled = true;
                break;
            }
            // Any other DHCP setting (DHCP=no, DHCP=ipv4, etc) means DHCP is disabled
        }
        fclose(network_fp);
    }
    cJSON_AddBoolToObject(root, "dh", dhcp_enabled);

    close(sockfd);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    DBG_INFO("Network info: %s", json_str);
    return json_str;
}

static bool restart_network(void) {
    DBG_INFO("Restarting network service");
    
    // Restart systemd-networkd service
    int ret = system("systemctl restart systemd-networkd");
    if (ret != 0) {
        DBG_ERROR("Failed to restart systemd-networkd service");
        return false;
    }

    // Wait for network to be up (max 5 seconds)
    int retries = 5;
    while (retries > 0) {
        ret = system("ip link show eth0 | grep -q 'state UP'");
        if (ret == 0) {
            DBG_INFO("Network interface eth0 is up");
            return true;
        }
        sleep(1);
        retries--;
    }

    DBG_ERROR("Network interface eth0 failed to come up");
    return false;
}


static char* read_network_config(void) {
    char *json_str = NULL;
    size_t buf_size = 4096;  // Initial buffer size
    
    // Allocate initial buffer
    json_str = calloc(1, buf_size);
    if (!json_str) {
        DBG_ERROR("Failed to allocate memory for network config");
        return NULL;
    }

    // Read network config from database
    int read_len = db_read("network_config", json_str, buf_size);
    if (read_len <= 0) {
        DBG_ERROR("Failed to read network config from database");
        free(json_str);
        return NULL;
    }

    DBG_INFO("Network config read from database successfully");
    return json_str;
}

static bool write_network_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    // Parse JSON configuration
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse network config JSON");
        return false;
    }

    // Open network config file
    FILE *fp = fopen("/lib/systemd/network/80-wired.network", "w");
    if (!fp) {
        DBG_ERROR("Failed to open network config file");
        cJSON_Delete(root);
        return false;
    }

    // Write common header
    fprintf(fp, "[Match]\n");
    fprintf(fp, "Name=eth0\n");
    fprintf(fp, "KernelCommandLine=!nfsroot\n\n");

    // Write Network section
    fprintf(fp, "[Network]\n");
    
    // Check if DHCP is enabled
    cJSON *dh = cJSON_GetObjectItem(root, "dh");
    if (dh && dh->type == cJSON_True) {
        // DHCP mode
        fprintf(fp, "DHCP=yes\n\n");
    } else {
        // Static IP mode
        cJSON *ip = cJSON_GetObjectItem(root, "ip");
        cJSON *sm = cJSON_GetObjectItem(root, "sm");
        cJSON *gw = cJSON_GetObjectItem(root, "gw");
        cJSON *d1 = cJSON_GetObjectItem(root, "d1");
        cJSON *d2 = cJSON_GetObjectItem(root, "d2");
        
        if (ip && sm) {
            // Convert netmask to CIDR notation
            char *netmask = sm->valuestring;
            unsigned int mask[4];
            int cidr = 0;
            
            if (sscanf(netmask, "%u.%u.%u.%u", &mask[0], &mask[1], &mask[2], &mask[3]) == 4) {
                // Calculate CIDR by counting consecutive 1s from left to right
                for (int i = 0; i < 4; i++) {
                    unsigned int m = mask[i];
                    for (int j = 0; j < 8; j++) {
                        if (m & 0x80) {
                            cidr++;
                        } else {
                            // If we find a 0, we should stop counting
                            goto done_cidr;
                        }
                        m <<= 1;
                    }
                }
            }
done_cidr:
            fprintf(fp, "Address=%s/%d\n", ip->valuestring, cidr);
        }
        
        if (gw && gw->valuestring[0] != '\0') {
            fprintf(fp, "Gateway=%s\n", gw->valuestring);
        }

        // Add DNS servers in Network section
        if (d1 && d1->valuestring && d1->valuestring[0] != '\0') {
            fprintf(fp, "DNS=%s\n", d1->valuestring);
        }
        if (d2 && d2->valuestring && d2->valuestring[0] != '\0') {
            fprintf(fp, "DNS=%s\n", d2->valuestring);
        }
        fprintf(fp, "\n");
    }

    // Write DHCP section
    fprintf(fp, "[DHCP]\n");
    fprintf(fp, "RouteMetric=10\n");
    fprintf(fp, "ClientIdentifier=mac\n");

    // Close network config file
    fclose(fp);

    // Write DNS configuration to resolv.conf
    FILE *resolv_fp = fopen("/etc/resolv.conf", "w");
    if (!resolv_fp) {
        DBG_ERROR("Failed to open resolv.conf");
        cJSON_Delete(root);
        return false;
    }

    // Get DNS servers from JSON
    cJSON *d1 = cJSON_GetObjectItem(root, "d1");
    cJSON *d2 = cJSON_GetObjectItem(root, "d2");

    // Write DNS servers if they exist and are not empty
    if (d1 && d1->valuestring && d1->valuestring[0] != '\0') {
        fprintf(resolv_fp, "nameserver %s\n", d1->valuestring);
    }
    if (d2 && d2->valuestring && d2->valuestring[0] != '\0') {
        fprintf(resolv_fp, "nameserver %s\n", d2->valuestring);
    }

    fclose(resolv_fp);
    cJSON_Delete(root);

    DBG_INFO("Network config written and applied successfully");
    return true;
}

bool apply_network_config(void) {
    // Read network config from database
    char *json_str = read_network_config();
    if (!json_str) {
        DBG_ERROR("Failed to read network config from database");
        return false;
    }

    // Write network config to system
    bool success = write_network_config(json_str);
    free(json_str);

    if (!success) {
        DBG_ERROR("Failed to write network config");
        return false;
    }

    // Restart network to apply changes
    if (!restart_network()) {
        DBG_ERROR("Failed to restart network");
        return false;
    }

    DBG_INFO("Network config applied successfully");
    return true;
}


static bool write_system_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }   

    // Write system config to database
    int result = db_write("system_config", (void*)json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write system config to database");
        return false;
    }   

    DBG_INFO("System config written to database successfully");
    return true;
}

static char* read_system_config(void) {
    char *json_str = NULL;
    size_t buf_size = 4096;  // Initial buffer size
    
    // Allocate initial buffer
    json_str = calloc(1, buf_size);
    if (!json_str) {
        DBG_ERROR("Failed to allocate memory for system config");
        return NULL;
    }

    // Read system config from database
    int read_len = db_read("system_config", json_str, buf_size);
    if (read_len <= 0) {
        DBG_ERROR("Failed to read system config from database");
        free(json_str);
        return NULL;
    }

    DBG_INFO("System config read from database successfully");
    return json_str;
}

static bool write_device_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    // Write device config to database
    int result = db_write("device_config", (void*)json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write device config to database");
        return false;
    }

    DBG_INFO("Device config written to database successfully");
    return true;
}

static char* read_device_config(void) {
    char *json_str = NULL;
    size_t buf_size = 16*4096;  // Initial buffer size
    
    // Allocate initial buffer
    json_str = calloc(1, buf_size);
    if (!json_str) {
        DBG_ERROR("Failed to allocate memory for device config");
        return NULL;
    }

    // Read device config from database
    int read_len = db_read("device_config", json_str, buf_size);
    if (read_len <= 0) {
        DBG_ERROR("Failed to read device config from database");
        free(json_str);
        return NULL;
    }

    DBG_INFO("Device config read from database successfully");
    return json_str;
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

static bool write_event_config(const char *json_str) {
    if (!json_str) {
        DBG_ERROR("Invalid JSON string");
        return false;
    }

    // Write event config to database
    int result = db_write("event_config", (void*)json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write event config to database");
        return false;
    }

    DBG_INFO("Event config written to database successfully");
    return true;
}

static char* read_event_config(void) {
    char *json_str = NULL;
    size_t buf_size = 16*4096;  // Initial buffer size
    
    // Allocate initial buffer
    json_str = calloc(1, buf_size);
    if (!json_str) {
        DBG_ERROR("Failed to allocate memory for event config");
        return NULL;
    }

    // Read event config from database
    int read_len = db_read("event_config", json_str, buf_size);
    if (read_len <= 0) {
        DBG_ERROR("Failed to read event config from database");
        free(json_str);
        return NULL;
    }

    DBG_INFO("Event config read from database successfully");
    return json_str;
}

static void handle_devices_get(struct mg_connection *c) {
    DBG_INFO("Devices get");
    char *json_str = read_device_config();
    if (json_str) {
        mg_http_reply(c, 200, s_json_header, "%s", json_str);
        free(json_str);
    } else {
    mg_http_reply(c, 200, s_json_header, "%s", "[]");
}
}

static void handle_system_get(struct mg_connection *c) {
    DBG_INFO("System get");
    char *json_str = read_system_config();
    if (json_str) {
        mg_http_reply(c, 200, s_json_header, "%s", json_str);
        free(json_str);
    } else {
        mg_http_reply(c, 200, s_json_header, "%s", "{}");
    }
}

static void handle_network_get(struct mg_connection *c) {
    char *json_str = read_network_config();
    if (!json_str) {
        mg_http_reply(c, 200, s_json_header, "%s", "{}");
        return;
    }

    // Parse JSON to check DHCP status
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        mg_http_reply(c, 200, s_json_header, "%s", json_str);
        free(json_str);
        return;
    }

    // Check DHCP status
    cJSON *dhcp = cJSON_GetObjectItem(root, "dh");
    if (dhcp && cJSON_IsTrue(dhcp)) {
        // DHCP is enabled, get current network config from system
        char *current_config = get_network_info();
        if (current_config) {
            mg_http_reply(c, 200, s_json_header, "%s", current_config);
            free(current_config);
            cJSON_Delete(root);
            free(json_str);
            return;
        }
    }

    // If DHCP is disabled or any error occurred, return original config
    mg_http_reply(c, 200, s_json_header, "%s", json_str);
    cJSON_Delete(root);
    free(json_str);
}

static void handle_network_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    int result = db_write("network_config", (void*)json_str, strlen(json_str) + 1);
    if (result != 0) {
        DBG_ERROR("Failed to write network config to database");
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to write network config to database\"}");
    }
    else {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    }
    free(json_str);
}

static void handle_system_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    bool success = write_system_config(json_str);
    free(json_str);
    
    if (success) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply system configuration\"}");
    }
}

static void handle_devices_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    bool success = write_device_config(json_str);
    free(json_str);
    
    if (success) {
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

    bool success = write_card_config(json_str);
    free(json_str);
    
    if (success) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply card configuration\"}");
    }
}

static void handle_card_get(struct mg_connection *c) {
    char *json_str = read_card_config();
    if (json_str) {
        mg_http_reply(c, 200, s_json_header, "%s", json_str);
        free(json_str);
    } else {
        mg_http_reply(c, 200, s_json_header, "%s", "[]");
    }
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

static void handle_event_get(struct mg_connection *c) {
    char *json_str = read_event_config();
    if (json_str) {
        mg_http_reply(c, 200, s_json_header, "%s", json_str);
        free(json_str);
    } else {
        mg_http_reply(c, 200, s_json_header, "%s", "[]");
    }
}

static void handle_event_set(struct mg_connection *c, struct mg_http_message *hm) {
    char *json_str = calloc(1, hm->body.len + 1);
    if (!json_str) {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to allocate memory\"}");
        return;
    }
    memcpy(json_str, hm->body.buf, hm->body.len);
    json_str[hm->body.len] = '\0';

    bool success = write_event_config(json_str);
    free(json_str);
    
    if (success) {
        mg_http_reply(c, 200, s_json_header, "{\"status\":\"success\"}");
    } else {
        mg_http_reply(c, 500, s_json_header, "{\"error\":\"Failed to apply event configuration\"}");
    }
}

static bool get_http_config(char *url, size_t url_size, int *port) {
    if (!url || !port) {
        DBG_ERROR("Invalid parameters");
        return false;
    }

    // Read system config from database
    char *json_str = read_system_config();
    if (!json_str) {
        DBG_ERROR("Failed to read system config");
        return false;
    }

    // Parse JSON configuration
    cJSON *root = cJSON_Parse(json_str);
    if (!root) {
        DBG_ERROR("Failed to parse system config JSON");
        free(json_str);
        return false;
    }

    // Get HTTP port from config
    cJSON *http_port = cJSON_GetObjectItem(root, "hport");

    // Always use default HTTP URL
    strncpy(url, DEFAULT_HTTP_URL, url_size - 1);
    url[url_size - 1] = '\0';

    if (http_port && http_port->type == cJSON_Number) {
        *port = http_port->valueint;
    } else {
        *port = DEFAULT_HTTP_PORT;
    }

    cJSON_Delete(root);
    free(json_str);

    DBG_INFO("HTTP config: URL=%s, Port=%d", url, *port);
    return true;
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
    char http_url[128];
    int http_port;

    // Get HTTP configuration from system config
    if (!get_http_config(http_url, sizeof(http_url), &http_port)) {
        DBG_ERROR("Failed to get HTTP config, using defaults");
        strncpy(http_url, DEFAULT_HTTP_URL, sizeof(http_url) - 1);
        http_port = DEFAULT_HTTP_PORT;
    }

    mg_mgr_init(&mgr);
    snprintf(listen_url, sizeof(listen_url), "%s:%d", http_url, http_port);
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

