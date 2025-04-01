#include "status.h"

typedef struct {
    char *sys_sn;
    char *sys_mac;
    char *sys_imei;
    char *sys_iccid;
    char *sys_time;
    time_t sys_unix_time;
} status_value_t;

status_value_t status_values = {
    .sys_sn = "1234567890",
    .sys_mac = "12:34:56:78:90",
    .sys_imei = "123456789012345",
    .sys_iccid = "1234567890123456789",
    .sys_time = "2021-01-01 00:00:00",
    .sys_unix_time = 1609459200,
};

status_item_t status_items[] = {
    {
        .name = "sys_sn",
        .value = &status_values.sys_sn,
        .type = STATUS_ITEM_TYPE_STRING,
    },
    {
        .name = "sys_mac",
        .value = &status_values.sys_mac,
        .type = STATUS_ITEM_TYPE_STRING,
    },
    {
        .name = "sys_imei",
        .value = &status_values.sys_imei,
        .type = STATUS_ITEM_TYPE_STRING,
    },
    {
        .name = "sys_iccid",
        .value = &status_values.sys_iccid,
        .type = STATUS_ITEM_TYPE_STRING,
    },
    {
        .name = "sys_time",
        .value = &status_values.sys_time,
        .type = STATUS_ITEM_TYPE_STRING,
    },
    {
        .name = "sys_unix_time",
        .value = &status_values.sys_unix_time,
        .type = STATUS_ITEM_TYPE_NUMBER,
    },
    {NULL, NULL, 0}    
};

