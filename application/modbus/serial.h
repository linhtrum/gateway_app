#ifndef SERIAL_H
#define SERIAL_H

#include <stdint.h>

int serial_open(const char *port, int baud);
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms);
int serial_write(int fd, const uint8_t *buf, int len);
void serial_close(int fd);
void serial_flush(int fd);

#endif
