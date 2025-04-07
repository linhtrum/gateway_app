CC = gcc
CFLAGS = -Wall -Wextra -g
# CFLAGS = -O2 -g
INCLUDE = -I./packages/mongoose \
		-I./packages/cJSON \
		-I./application/web_server \
		-I./packages/FlashDB/inc \
		-I./packages/agile_modbus/inc \
		-I./packages/agile_modbus/util \
		-I./packages/tinyexpr \
		-I./application/database \
		-I./application/log \
		-I./application/modbus \
		-I./application/system \
		-I./application/event \
		-I./application/network \
		-I./application/mqtt \

LIB = -lpthread -lrt -lpaho-mqtt3a -lm

TARGET = app

SRCS = application/main.c \
       application/web_server/net.c \
       packages/mongoose/mongoose.c \
       packages/cJSON/cJSON.c \
       packages/FlashDB/src/fdb_kvdb.c \
		packages/FlashDB/src/fdb_file.c \
		packages/FlashDB/src/fdb_tsdb.c \
		packages/FlashDB/src/fdb_utils.c \
		packages/FlashDB/src/fdb.c \
		application/database/db.c \
		application/modbus/device.c \
		application/modbus/rtu_master.c \
		application/modbus/serial.c \
		packages/agile_modbus/src/agile_modbus.c \
		packages/agile_modbus/src/agile_modbus_rtu.c \
		packages/agile_modbus/src/agile_modbus_tcp.c \
		packages/agile_modbus/util/agile_modbus_slave_util.c \
		packages/tinyexpr/tinyexpr.c \
		application/log/log_buffer.c \
		application/log/log_output.c \
		application/system/system.c \
		application/web_server/websocket.c \
		application/event/event_handle.c \
		application/event/event.c \
		application/network/network.c \
		application/system/management.c \
		application/mqtt/mqtt.c \
		application/mqtt/mqtt_handle.c \
		application/modbus/tcp.c \

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