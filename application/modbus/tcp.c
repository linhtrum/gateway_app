#include "tcp.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/select.h>
#include <sys/time.h>
#include <errno.h>
#include <time.h>
#include "cJSON.h"
#include "db.h"
#include "../log/log_output.h"

#define DBG_TAG "TCP"
#define DBG_LVL LOG_INFO
#include "dbg.h"


#define TCP_TIMEOUT 10000

// Connect to TCP server
int tcp_connect(const char *server_address, int server_port) {
    if (!server_address || server_port <= 0) {
        DBG_ERROR("Invalid server address or port");
        return -1;
    }

    // Create socket
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        DBG_ERROR("Failed to create socket");
        return -1;
    }

    // Set socket options
    int opt = 1;
    if (setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        DBG_ERROR("Failed to set socket options");
        close(fd);
        return -1;
    }

    // Set non-blocking mode
    int flags = fcntl(fd, F_GETFL, 0);
    if (fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) {
        DBG_ERROR("Failed to set non-blocking mode");
        close(fd);
        return -1;
    }

    // Connect to server
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(server_port);

    if (inet_pton(AF_INET, server_address, &addr.sin_addr) <= 0) {
        DBG_ERROR("Invalid server address");
        close(fd);
        return -1;
    }

    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        if (errno != EINPROGRESS) {
            DBG_ERROR("Failed to connect to server");
            close(fd);
            return -1;
        }
    }

    // Wait for connection to complete
    fd_set rset, wset;
    struct timeval tv;
    FD_ZERO(&rset);
    FD_ZERO(&wset);
    FD_SET(fd, &rset);
    FD_SET(fd, &wset);

    tv.tv_sec = TCP_TIMEOUT / 1000;
    tv.tv_usec = (TCP_TIMEOUT % 1000) * 1000;

    int ret = select(fd + 1, &rset, &wset, NULL, &tv);
    if (ret <= 0) {
        DBG_ERROR("Connection timeout");
        close(fd);
        return -1;
    }

    // Check for connection errors
    int error = 0;
    socklen_t len = sizeof(error);
    if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &len) < 0 || error != 0) {
        DBG_ERROR("Connection failed");
        close(fd);
        return -1;
    }

    DBG_INFO("Connected to TCP server %s:%d", server_address, server_port);
    return fd;
}

// Read data from TCP socket
int tcp_read(int fd, uint8_t *buf, int len, int timeout_ms, int byte_timeout_ms) {
    if (fd < 0 || !buf || len <= 0) {
        DBG_ERROR("Invalid parameters");
        return -1;
    }

    fd_set rdset;
    struct timeval tv;
    int ret;
    int total_read = 0;
    int remaining = len;

    while (remaining > 0) {
        FD_ZERO(&rdset);
        FD_SET(fd, &rdset);

        tv.tv_sec = timeout_ms / 1000;
        tv.tv_usec = (timeout_ms % 1000) * 1000;
        ret = select(fd + 1, &rdset, NULL, NULL, &tv);
        if (ret < 0) {
            DBG_ERROR("Select error");
            return -1;
        }
        if (ret == 0) {
            if (total_read > 0) {
                // If we've read some data and hit byte timeout, return what we have
                DBG_DEBUG("Byte timeout after reading %d bytes", total_read);
                return total_read;
            }
            DBG_WARN("No data available within timeout");
            return 0;
        }

        ret = recv(fd, buf + total_read, remaining, 0);
        if (ret < 0) {
            DBG_ERROR("Receive error");
            return -1;
        }
        if (ret == 0) {
            // Connection closed
            return total_read;
        }

        total_read += ret;
        remaining -= ret;

        // Use byte timeout for subsequent reads
        timeout_ms = byte_timeout_ms;
    }

    return total_read;
}

// Write data to TCP socket
int tcp_write(int fd, const uint8_t *buf, int len) {
    if (fd < 0 || !buf || len <= 0) {
        DBG_ERROR("Invalid parameters");
        return -1;
    }

    // Send data directly
    int ret = send(fd, buf, len, 0);
    if (ret < 0) {
        DBG_ERROR("Send error");
        return -1;
    }

    return ret;
}

// Flush TCP receive buffer only
void tcp_flush_rx(int fd) {
    if (fd < 0) {
        DBG_ERROR("Invalid parameters");
        return;
    }

    // Read and discard any pending data
    uint8_t dummy[1024];
    while (recv(fd, dummy, sizeof(dummy), MSG_DONTWAIT) > 0);
}

// Close TCP connection
void tcp_close(int fd) {
    if (fd < 0) {
        DBG_ERROR("Invalid parameters");
        return;
    }

    close(fd);
    DBG_INFO("TCP connection closed");
}
