#ifndef TCP_H
#define TCP_H

#include <stdint.h>
#include <stdbool.h>

#define DEFAULT_TCP_TIMEOUT 1000

// Function declarations
int tcp_connect(const char *server_address, int server_port);
int tcp_read(int fd, uint8_t *buf, int len, int timeout_ms, int byte_timeout_ms);
int tcp_write(int fd, const uint8_t *buf, int len);
void tcp_flush_rx(int fd);
void tcp_close(int fd);

#endif /* TCP_H */ 