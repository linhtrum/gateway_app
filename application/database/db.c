#include "db.h"
#include <stdio.h>
#include <stdbool.h>
#include <pthread.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <flashdb.h>

#define DBG_TAG "DB"
#define DBG_LVL LOG_INFO
#include "dbg.h"

#define DB_NAME "env"
#define DB_PATH "fdb_kvdb1"
#define DB_SEC_SIZE 4096
#define DB_MAX_SIZE DB_SEC_SIZE * 256

static struct fdb_kvdb kvdb;
static pthread_mutex_t kv_locker, ts_locker;
static pthread_mutexattr_t kv_locker_attr, ts_locker_attr;
static uint32_t boot_count = 0;
static struct fdb_default_kv_node default_kv_table[] = {
        {"username", "admin", 0}, 
        {"password", "admin", 0}, 
        {"boot_count", &boot_count, sizeof(boot_count)}, 
};

static void lock(fdb_db_t db)
{
    pthread_mutex_lock((pthread_mutex_t *)db->user_data);
}

static void unlock(fdb_db_t db)
{
    pthread_mutex_unlock((pthread_mutex_t *)db->user_data);
}

static bool is_db_initialized(void)
{
    return kvdb.parent.init_ok;
}

int db_init(void)
{
    fdb_err_t result;
    bool file_mode = true;
    uint32_t sec_size = DB_SEC_SIZE, db_size = DB_MAX_SIZE;

    if (is_db_initialized()) {
        DBG_WARN("DB already initialized");
        return 0;
    }

    struct fdb_default_kv default_kv;
    default_kv.kvs = default_kv_table;
    default_kv.num = sizeof(default_kv_table) / sizeof(default_kv_table[0]);
    
    pthread_mutexattr_init(&kv_locker_attr);
    pthread_mutexattr_settype(&kv_locker_attr, PTHREAD_MUTEX_RECURSIVE);
    pthread_mutex_init(&kv_locker, &kv_locker_attr);

    fdb_kvdb_control(&kvdb, FDB_KVDB_CTRL_SET_LOCK, (void *)lock);
    fdb_kvdb_control(&kvdb, FDB_KVDB_CTRL_SET_UNLOCK, (void *)unlock);
    
    fdb_kvdb_control(&kvdb, FDB_KVDB_CTRL_SET_SEC_SIZE, &sec_size);
    fdb_kvdb_control(&kvdb, FDB_KVDB_CTRL_SET_MAX_SIZE, &db_size);
    fdb_kvdb_control(&kvdb, FDB_KVDB_CTRL_SET_FILE_MODE, &file_mode);
    
    mkdir(DB_PATH, 0777);
    
    result = fdb_kvdb_init(&kvdb, DB_NAME, DB_PATH, &default_kv, &kv_locker);
    if (result != FDB_NO_ERR) {
        DBG_ERROR("Failed to initialize KVDB: %d", result);
        return -1;
    }
    DBG_INFO("KVDB initialized");
    
    return 0;
}

int db_read(const char *key, void *data, uint32_t len)
{
    if (!is_db_initialized()) {
        DBG_WARN("DB is not initialized");
        return -1;
    }

    fdb_err_t result;
    struct fdb_blob blob = { 0 };
    blob.buf = data;
    blob.size = len;
    result = fdb_kv_get_blob(&kvdb, key, &blob);
    DBG_DEBUG("db_read: %s %p %d %d", key, data, len, result);
    return result;
}


int db_write(const char *key, void *data, uint32_t len)
{
    if (!is_db_initialized()) {
        DBG_WARN("DB is not initialized");
        return -1;
    }

    fdb_err_t result;
    struct fdb_blob blob = { 0 };
    blob.buf = data;
    blob.size = len;
    result = fdb_kv_set_blob(&kvdb, key, &blob);
    DBG_DEBUG("db_write: %s %p %d %d", key, data, len, result);
    return result;
}

int db_delete(const char *key)
{
    if (!is_db_initialized()) {
        DBG_WARN("DB is not initialized");
        return -1;
    }

    fdb_err_t result;
    result = fdb_kv_del(&kvdb, key);
    DBG_DEBUG("db_delete: %s %d", key, result);
    return result;
}

int db_clear(void)
{
    if (!is_db_initialized()) {
        DBG_WARN("DB is not initialized");
        return -1;
    }
    
    fdb_err_t result;
    result = fdb_kv_set_default(&kvdb);
    DBG_DEBUG("db_clear: %d", result);
    return result;
}







