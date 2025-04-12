CC = gcc
CFLAGS = -Wall -Wextra -g
# CFLAGS = -O2 -g
INCLUDE = -I./mongoose \
		-I./cJSON \
		-I./FlashDB/inc \
		-I./agile_modbus/inc \
		-I./agile_modbus/util \
		-I./application/web_server \
		-I./application/database \
		-I./application/log \
		-I./application/modbus \
		-I./application/system
LIB = -lpthread
TARGET = app
SRCS = application/main.c \
       application/web_server/net.c \
       mongoose/mongoose.c \
       cJSON/cJSON.c \
       FlashDB/src/fdb_kvdb.c \
		FlashDB/src/fdb_file.c \
		FlashDB/src/fdb_tsdb.c \
		FlashDB/src/fdb_utils.c \
		FlashDB/src/fdb.c \
		application/database/db.c \
		application/modbus/rtu_master.c \
		application/modbus/serial.c \
		agile_modbus/src/agile_modbus.c \
		agile_modbus/src/agile_modbus_rtu.c \
		agile_modbus/src/agile_modbus_tcp.c \
		agile_modbus/util/agile_modbus_slave_util.c \
		application/log/log_buffer.c \
		application/log/log_output.c \
		application/system/system.c \
		application/web_server/websocket.c \
		application/modbus/serial_config.c
		
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