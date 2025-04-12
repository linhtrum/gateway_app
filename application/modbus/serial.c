#include "serial.h"
#include "serial_config.h"
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <termios.h>
#include <unistd.h>
#include <sys/select.h>
#include <sys/time.h>
#include <errno.h>
#define DBG_TAG "SERIAL"
#define DBG_LVL LOG_INFO
#include "dbg.h"

int serial_open(const char *port, int baud, int data_bits, int parity, int stop_bits, int flow_control) {
    struct termios tty;
    int fd;
    
    // Open serial port
    fd = open(port, O_RDWR | O_NOCTTY | O_NONBLOCK);
    if (fd < 0) {
        DBG_ERROR("Failed to open serial port %s", port);
        return -1;
    }

    // Get current port settings
    if (tcgetattr(fd, &tty) != 0) {
        DBG_ERROR("Failed to get port settings");
        close(fd);
        return -1;
    }

    // Set baud rate
    speed_t speed;
    switch (baud) {
        case 9600:   speed = B9600;   break;
        case 19200:  speed = B19200;  break;
        case 38400:  speed = B38400;  break;
        case 57600:  speed = B57600;  break;
        case 115200: speed = B115200; break;
        default:
            DBG_ERROR("Unsupported baud rate: %d", baud);
            close(fd);
            return -1;
    }

    cfsetispeed(&tty, speed);
    cfsetospeed(&tty, speed);

    // Set data bits
    tty.c_cflag &= ~CSIZE;
    switch (data_bits) {
        case 7: tty.c_cflag |= CS7; break;
        case 8: tty.c_cflag |= CS8; break;
        default:
            DBG_ERROR("Unsupported data bits: %d", data_bits);
            close(fd);
            return -1;
    }

    // Set stop bits
    switch (stop_bits) {
        case 1: tty.c_cflag &= ~CSTOPB; break;
        case 2: tty.c_cflag |= CSTOPB; break;
        default:
            DBG_ERROR("Unsupported stop bits: %d", stop_bits);
            close(fd);
            return -1;
    }

    // Set parity
    switch (parity) {
        case 0: // None
            tty.c_cflag &= ~PARENB;
            break;
        case 1: // Odd
            tty.c_cflag |= PARENB;
            tty.c_cflag |= PARODD;
            break;
        case 2: // Even 
            tty.c_cflag |= PARENB;
            tty.c_cflag &= ~PARODD;
            break;
        default:
            DBG_ERROR("Unsupported parity: %d", parity);
            close(fd);
            return -1;
    }

    // Set flow control
    switch (flow_control) {
        case 0: // None
            tty.c_cflag &= ~CRTSCTS;
            tty.c_iflag &= ~(IXON | IXOFF | IXANY);
            break;
        case 1: // RTS/CTS
            tty.c_cflag |= CRTSCTS;
            tty.c_iflag &= ~(IXON | IXOFF | IXANY);
            break;
        case 2: // XON/XOFF
            tty.c_cflag &= ~CRTSCTS;
            tty.c_iflag |= (IXON | IXOFF | IXANY);
            break;
        default:    
            DBG_ERROR("Unsupported flow control: %d", flow_control);
            close(fd);
            return -1;
    }
    
    // Enable receiver, ignore modem control lines
    tty.c_cflag |= CREAD | CLOCAL;

    // Raw mode
    tty.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG);
    tty.c_iflag &= ~(IXON | IXOFF | IXANY);
    tty.c_oflag &= ~OPOST;

    // Set read timeout
    tty.c_cc[VMIN] = 0;      // No minimum characters
    tty.c_cc[VTIME] = 0;     // No timeout
    
    // Apply settings
    if (tcsetattr(fd, TCSANOW, &tty) != 0) {
        DBG_ERROR("Failed to set port settings");
        close(fd);
        return -1;
    }

    DBG_INFO("Serial port %s opened successfully with configuration: baud=%d, data_bits=%d, parity=%d, stop_bits=%d, flow_control=%d", port, baud, data_bits, parity, stop_bits, flow_control);
    return fd;
}

// Read data from serial port
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms, int bytes_timeout) {
    if (fd < 0 || buf == NULL || len <= 0) {
        DBG_ERROR("Invalid parameters");
        return -1;
    }

    fd_set rdset;
    struct timeval timeout;
    int ret;
    int total_read = 0;
    int remaining = len;

    while (remaining > 0) {
        FD_ZERO(&rdset);
        FD_SET(fd, &rdset);

        timeout.tv_sec = timeout_ms / 1000;
        timeout.tv_usec = (timeout_ms % 1000) * 1000;

        ret = select(fd + 1, &rdset, NULL, NULL, &timeout);
        if (ret < 0) {
            DBG_ERROR("Select error");
            return -1;
        }
        if (ret == 0) {
            if(total_read > 0) {
                DBG_WARN("Read timeout, total_read=%d", total_read);
                return total_read;
            }
            DBG_WARN("Read timeout");
            return 0;
        }

        ret = read(fd, buf + total_read, remaining);
        if (ret < 0) {
            DBG_ERROR("Read error");
            return -1;
        }
        if (ret == 0) {
            DBG_WARN("Read timeout");
            return total_read;
        }

        total_read += ret;
        remaining -= ret;

        // Reset timeout to bytes_timeout        
        timeout_ms = bytes_timeout;
    }
    return total_read;
}

// Write data to serial port
int serial_write(int fd, const uint8_t *buf, int len) {
    if (fd < 0) {
        DBG_ERROR("Invalid file descriptor");
        return -1;
    }

    int ret = write(fd, buf, len);
    if (ret < 0) {
        DBG_ERROR("Write error");
        return -1;
    }
    
    // Wait for all data to be transmitted
    tcdrain(fd);

    return ret;
}

// Flush serial port buffers
void serial_flush(int fd) {
    if (fd < 0) {
        DBG_ERROR("Invalid file descriptor");
        return;
    }

    // Flush both input and output buffers
    if (tcflush(fd, TCIOFLUSH) < 0) {
        DBG_ERROR("Failed to flush serial buffers");
    }
}


// Close serial port
void serial_close(int fd) {
    if (fd >= 0) {
        close(fd);
        DBG_INFO("Serial port closed");
    }
}
