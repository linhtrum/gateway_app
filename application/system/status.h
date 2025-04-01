#ifndef STATUS_H
#define STATUS_H

#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include <string.h>

typedef enum {
    STATUS_ITEM_TYPE_STRING,
    STATUS_ITEM_TYPE_NUMBER,
    STATUS_ITEM_TYPE_BOOLEAN,
} status_item_type_t;

typedef struct {
    char *name;
    void *value;
    status_item_type_t type;
} status_item_t;


#endif
