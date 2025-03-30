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
static pthread_mutex_t kv_locker;
static pthread_mutexattr_t kv_locker_attr;
static uint32_t boot_count = 0;
static struct fdb_default_kv_node default_kv_table[] = {
        {"card_config", "[{\"t\":\"Rack001\",\"dn\":\"device01\",\"tn\":{\"n\":\"node0101\",\"a\":1,\"f\":3,\"dt\":5,\"t\":1000},\"hn\":{\"n\":\"node0102\",\"a\":2,\"f\":3,\"dt\":5,\"t\":1000}},{\"t\":\"Rack002\",\"dn\":\"device02\",\"tn\":{\"n\":\"node0201\",\"a\":1,\"f\":3,\"dt\":5,\"t\":1000},\"hn\":{\"n\":\"node0202\",\"a\":2,\"f\":3,\"dt\":5,\"t\":1000}}]", 0}, 
        {"network_config", "{\"if\":\"eth0\",\"dh\":true,\"ip\":\"192.168.0.10\",\"sm\":\"255.255.255.0\",\"gw\":\"192.168.0.1\",\"d1\":\"8.8.8.8\",\"d2\":\"8.8.4.4\"}", 0}, 
        {"device_config", "[{\"n\":\"device01\",\"da\":1,\"pi\":1000,\"g\":false,\"ns\":[{\"n\":\"node0101\",\"a\":1,\"f\":3,\"dt\":5,\"t\":1000},{\"n\":\"node0102\",\"a\":2,\"f\":3,\"dt\":5,\"t\":1000}]},{\"n\":\"device02\",\"da\":2,\"pi\":1000,\"g\":false,\"ns\":[{\"n\":\"node0201\",\"a\":1,\"f\":3,\"dt\":5,\"t\":1000},{\"n\":\"node0202\",\"a\":2,\"f\":3,\"dt\":5,\"t\":1000}]}]", 0}, 
        {"system_config", "{\"username\":\"admin\",\"password\":\"admin\",\"server1\":\"2.vn.pool.ntp.org\",\"server2\":\"0.asia.pool.ntp.org\",\"server3\":\"1.asia.pool.ntp.org\",\"timezone\":21,\"enabled\":true,\"hport\":8000,\"wport\":4002,\"logMethod\":0}", 0}, 
        {"event_config", "[{\"n\":\"event1\",\"e\":true,\"c\":1,\"p\":\"node0101\",\"sc\":100,\"mi\":1000,\"ut\":20000,\"lt\":0,\"te\":1,\"ta\":1,\"d\":\"\",\"id\":1742949455093},{\"n\":\"event2\",\"e\":true,\"c\":3,\"p\":\"node0102\",\"sc\":100,\"mi\":1000,\"ut\":20000,\"lt\":0,\"te\":1,\"ta\":1,\"d\":\"\",\"id\":1742949471952},{\"n\":\"event3\",\"e\":true,\"c\":5,\"p\":\"node0201\",\"sc\":100,\"mi\":1000,\"ut\":20000,\"lt\":0,\"te\":1,\"ta\":1,\"d\":\"\",\"id\":1742949480353}]", 0}, 
        {"serial_config", "{\"enabled\":true,\"port\":\"/dev/ttymxc1\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":0,\"flowControl\":0,\"timeout\":0,\"bufferSize\":0}", 0}, 
        {"mqtt_config", "{\"enabled\":true,\"version\":2,\"clientId\":\"123456\",\"serverAddress\":\"mqtt.tthd.vn\",\"port\":1883,\"keepAlive\":60,\"reconnectNoData\":0,\"reconnectInterval\":5,\"cleanSession\":true,\"useCredentials\":true,\"username\":\"admin\",\"password\":\"haiduong12\",\"enableLastWill\":false,\"lastWillQos\":0,\"lastWillRetained\":false,\"lastWillTopic\":\"/will\",\"lastWillMessage\":\"offline\"}", 0}, 
        {"publish_topics", "[{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic1\",\"topicAlias\":\"topic1\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic2\",\"topicAlias\":\"topic2\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic3\",\"topicAlias\":\"topic3\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic4\",\"topicAlias\":\"topic4\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic5\",\"topicAlias\":\"topic5\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic6\",\"topicAlias\":\"topic6\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic7\",\"topicAlias\":\"topic7\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Pubtopic8\",\"topicAlias\":\"topic8\",\"bindingPorts\":0,\"qos\":0,\"retainedMessage\":false,\"ioControlQuery\":false}]", 0}, 
        {"subscribe_topics", "[{\"enabled\":true,\"transmissionMode\":0,\"topicString\":\"/Subtopic1\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Subtopic2\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Subtopic3\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":true,\"transmissionMode\":0,\"topicString\":\"/Subtopic4\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Subtopic5\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Subtopic6\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Subtopic7\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false},{\"enabled\":false,\"transmissionMode\":0,\"topicString\":\"/Subtopic8\",\"delimiter\":\",\",\"bindingPorts\":0,\"qos\":0,\"ioControlQuery\":false}]", 0}, 
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







