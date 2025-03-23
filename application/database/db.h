#ifndef __DB_H__
#define __DB_H__

#include <stdint.h>

int db_init(void);
int db_read(const char *key, void *data, uint32_t len);
int db_write(const char *key, void *data, uint32_t len);
int db_delete(const char *key);
int db_clear(void);

#endif