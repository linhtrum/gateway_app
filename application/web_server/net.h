#ifndef __NET_H__
#define __NET_H__

#include "mongoose.h"
#include "cJSON.h"

struct thread_data {
  struct mg_mgr *mgr;
  unsigned long conn_id;  // Parent connection ID
};

void web_init(void);

struct thread_data *get_thread_data(void);
#endif
