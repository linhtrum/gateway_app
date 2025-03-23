CC = gcc
CFLAGS = -Wall -Wextra -g
INCLUDE = -I./packages/mongoose -I./packages/cJSON -I./application/web_server -I./packages/FlashDB/inc -I./packages/agile_modbus/inc -I./packages/agile_modbus/util -I./application/database -I./application/log -I./application/modbus -I./application/system -DMG_ENABLE_PACKED_FS=1
LIB = -lpthread
TARGET = app
SRCS = application/main.c \
       application/web_server/net.c \
       application/web_server/packed_fs.c \
       packages/mongoose/mongoose.c \
       packages/cJSON/cJSON.c \
       packages/FlashDB/src/fdb_kvdb.c \
		packages/FlashDB/src/fdb_file.c \
		packages/FlashDB/src/fdb_tsdb.c \
		packages/FlashDB/src/fdb_utils.c \
		packages/FlashDB/src/fdb.c \
		application/database/db.c \
		application/modbus/rtu_master.c \
		application/modbus/serial.c \
		packages/agile_modbus/src/agile_modbus.c \
		packages/agile_modbus/src/agile_modbus_rtu.c \
		packages/agile_modbus/src/agile_modbus_tcp.c \
		packages/agile_modbus/util/agile_modbus_slave_util.c \
		application/log/log_buffer.c \
		application/log/log_output.c \
		application/system/system.c
OBJS = $(SRCS:.c=.o)

run: clean all

all: $(TARGET)
	mv $(TARGET) out
	./out/$(TARGET)

$(TARGET): $(OBJS)
	$(CC) out/*.o -o $(TARGET) $(LIB)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@ $(INCLUDE)
	mv $@ out

clean:
	rm -rf out/*