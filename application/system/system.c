#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <pthread.h>

#define DBG_TAG "SYSTEM"
#define DBG_LVL LOG_ERROR
#include "dbg.h"

#define UDP_PORT 12345
#define BUFFER_SIZE 1024
#define MAX_IP_LEN 16
#define DEFAULT_INTERFACE "eth0"
#define DEFAULT_TIMEOUT_SEC 1
#define SLEEP_INTERVAL_US 10000  // 10ms

// Global flag for graceful shutdown
static volatile int g_running = 1;

static int get_network_info(char *response, size_t resp_size) {
    if (!response || resp_size == 0) {
        DBG_ERROR("Invalid parameters");
        return -1;
    }

    struct ifreq ifr;
    char ip[MAX_IP_LEN] = {0};
    char netmask[MAX_IP_LEN] = {0};
    char gateway[MAX_IP_LEN] = {0};
    char dns1[MAX_IP_LEN] = {0};
    char dns2[MAX_IP_LEN] = {0};
    int dhcp = 0;
    
    // Create socket for interface queries
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        DBG_ERROR("Failed to create socket for interface queries");
        return -1;
    }

    // Initialize interface request structure
    memset(&ifr, 0, sizeof(ifr));
    ifr.ifr_addr.sa_family = AF_INET;
    strncpy(ifr.ifr_name, DEFAULT_INTERFACE, IFNAMSIZ-1);

    // Get IP address
    if (ioctl(sock, SIOCGIFADDR, &ifr) >= 0) {
        strncpy(ip, inet_ntoa(((struct sockaddr_in *)&ifr.ifr_addr)->sin_addr), MAX_IP_LEN-1);
    } else {
        DBG_ERROR("Failed to get IP address");
    }

    // Get netmask
    if (ioctl(sock, SIOCGIFNETMASK, &ifr) >= 0) {
        strncpy(netmask, inet_ntoa(((struct sockaddr_in *)&ifr.ifr_netmask)->sin_addr), MAX_IP_LEN-1);
    } else {
        DBG_ERROR("Failed to get netmask");
    }

    close(sock);

    // Get gateway using ip route command
    FILE *fp = popen("ip route | grep default | awk '{print $3}'", "r");
    if (fp) {
        if (fgets(gateway, sizeof(gateway), fp)) {
            gateway[strcspn(gateway, "\n")] = 0;
        }
        pclose(fp);
    }

    // Get DNS servers from resolv.conf
    fp = fopen("/etc/resolv.conf", "r");
    if (fp) {
        char line[128];
        int dns_count = 0;
        while (fgets(line, sizeof(line), fp) && dns_count < 2) {
            if (strncmp(line, "nameserver", 10) == 0) {
                char *dns = line + 11;
                dns[strcspn(dns, "\n")] = 0;
                if (dns_count == 0) {
                    strncpy(dns1, dns, MAX_IP_LEN-1);
                } else {
                    strncpy(dns2, dns, MAX_IP_LEN-1);
                }
                dns_count++;
            }
        }
        fclose(fp);
    }

    // Check DHCP status
    fp = popen("ps aux | grep dhclient | grep -v grep", "r");
    if (fp) {
        dhcp = (fgets(gateway, sizeof(gateway), fp) != NULL);
        pclose(fp);
    }

    // Format JSON response
    int written = snprintf(response, resp_size,
             "{"
             "\"ip\":\"%s\","
             "\"netmask\":\"%s\","
             "\"gateway\":\"%s\","
             "\"dns1\":\"%s\","
             "\"dns2\":\"%s\","
             "\"dhcp\":%d"
             "}",
             ip, netmask, gateway, dns1, dns2, dhcp);

    return (written > 0 && written < resp_size) ? 0 : -1;
}

static void cleanup_socket(int sock) {
    if (sock >= 0) {
        shutdown(sock, SHUT_RDWR);
        close(sock);
    }
}

static int init_udp_socket(void) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        DBG_ERROR("Socket creation failed: %s", strerror(errno));
        return -1;
    }

    // Enable address reuse
    int reuse = 1;
    if (setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) < 0) {
        DBG_ERROR("Set SO_REUSEADDR failed: %s", strerror(errno));
        cleanup_socket(sock);
        return -1;
    }

    // Set receive timeout
    struct timeval tv = {
        .tv_sec = DEFAULT_TIMEOUT_SEC,
        .tv_usec = 0
    };
    if (setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv)) < 0) {
        DBG_ERROR("Set SO_RCVTIMEO failed: %s", strerror(errno));
        cleanup_socket(sock);
        return -1;
    }

    // Configure and bind socket
    struct sockaddr_in server_addr = {
        .sin_family = AF_INET,
        .sin_addr.s_addr = INADDR_ANY,
        .sin_port = htons(UDP_PORT)
    };

    if (bind(sock, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        DBG_ERROR("Bind failed: %s", strerror(errno));
        cleanup_socket(sock);
        return -1;
    }

    return sock;
}

static void *udp_server_thread(void *arg) {
    int sock = init_udp_socket();
    if (sock < 0) {
        return NULL;
    }

    struct sockaddr_in client_addr;
    char buffer[BUFFER_SIZE];
    socklen_t addr_len = sizeof(client_addr);

    DBG_INFO("UDP server started on port %d", UDP_PORT);

    while (g_running) {
        int recv_len = recvfrom(sock, buffer, BUFFER_SIZE-1, 0,
                               (struct sockaddr*)&client_addr, &addr_len);
        
        if (recv_len > 0) {
            buffer[recv_len] = '\0';
            DBG_INFO("Received message: %s", buffer);
            if (strcmp(buffer, "GET_NETWORK_INFO") == 0) {
                char response[BUFFER_SIZE];
                if (get_network_info(response, sizeof(response)) == 0) {
                    sendto(sock, response, strlen(response), 0,
                           (struct sockaddr*)&client_addr, addr_len);
                    DBG_INFO("Sent network info to %s", inet_ntoa(client_addr.sin_addr));
                } else {
                    DBG_ERROR("Failed to get network info");
                }
            }
        } else if (recv_len < 0) {
            if (errno != EAGAIN && errno != EWOULDBLOCK) {
                DBG_ERROR("recvfrom failed: %s", strerror(errno));
            }
            usleep(SLEEP_INTERVAL_US);
        }
    }

    cleanup_socket(sock);
    return NULL;
}

void stop_udp_server(void) {
    g_running = 0;
}

void start_udp_server(void) {
    pthread_t thread;
    pthread_attr_t attr;
    
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    
    int ret = pthread_create(&thread, &attr, udp_server_thread, NULL);
    if (ret != 0) {
        DBG_ERROR("Failed to create UDP server thread: %s", strerror(ret));
    }
    
    pthread_attr_destroy(&attr);
}
