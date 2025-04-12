#ifndef SERIAL_H
#define SERIAL_H

#include <stdint.h>

int serial_open(const char *port, int baud, int data_bits, int parity, int stop_bits, int flow_control);
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms, int bytes_timeout);
int serial_receive(int fd, uint8_t *buf, int bufsz, int timeout);
int serial_write(int fd, const uint8_t *buf, int len);
void serial_close(int fd);
void serial_flush(int fd);

#endif
