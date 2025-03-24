#ifndef WEBSOCKET_H
#define WEBSOCKET_H

#include <stdint.h>
#include <stdbool.h>

void websocket_log_start();
void websocket_log_send(const char *message);

#endif // WEBSOCKET_H