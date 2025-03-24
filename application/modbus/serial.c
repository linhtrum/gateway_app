#include "serial.h"
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

int serial_open(const char *port, int baud) {
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

    // 8N1 (8 bits, no parity, 1 stop bit)
    tty.c_cflag &= ~PARENB;  // No parity
    tty.c_cflag &= ~CSTOPB;  // 1 stop bit
    tty.c_cflag &= ~CSIZE;   // Clear size bits
    tty.c_cflag |= CS8;      // 8 bits
    
    // No flow control
    tty.c_cflag &= ~CRTSCTS;

    // Enable receiver, ignore modem control lines
    tty.c_cflag |= CREAD | CLOCAL;

    // Raw mode
    tty.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG);
    tty.c_iflag &= ~(IXON | IXOFF | IXANY);
    tty.c_oflag &= ~OPOST;

    // Set read timeout
    tty.c_cc[VMIN] = 0;      // No minimum characters
    tty.c_cc[VTIME] = 0;    // 10 second timeout

    // Apply settings
    if (tcsetattr(fd, TCSANOW, &tty) != 0) {
        DBG_ERROR("Failed to set port settings");
        close(fd);
        return -1;
    }

    DBG_INFO("Serial port %s opened successfully", port);
    return fd;
}

int serial_receive(int fd, uint8_t *buf, int bufsz, int timeout)
{
    int len = 0;
    int rc = 0;
    fd_set rset;
    struct timeval tv;

    while (bufsz > 0) {
        FD_ZERO(&rset);
        FD_SET(fd, &rset);

        tv.tv_sec = timeout / 1000;
        tv.tv_usec = (timeout % 1000) * 1000;
        rc = select(fd + 1, &rset, NULL, NULL, &tv);
        if (rc == -1) {
            if (errno == EINTR)
                continue;
        }

        if (rc <= 0) {
            break;
        }

        rc = read(fd, buf + len, bufsz);
        if (rc <= 0) {
            break;
        }
        len += rc;
        bufsz -= rc;

        timeout = 20;
    }

    if (rc >= 0) {
        rc = len;
    }

    return rc;
}

// Read data from serial port
int serial_read(int fd, uint8_t *buf, int len, int timeout_ms) {
    if (fd < 0) {
        DBG_ERROR("Invalid file descriptor");
        return -1;
    }

    fd_set rdset;
    struct timeval timeout;
    int ret;

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
        DBG_WARN("Read timeout");
        return 0;
    }

    ret = read(fd, buf, len);
    if (ret < 0) {
        DBG_ERROR("Read error");
        return -1;
    }

    return ret;
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
