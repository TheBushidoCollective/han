---
name: c-systems-programming
description: Use when writing low-level system software in C requiring file I/O, process management, signals, and system calls.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# C Systems Programming

Master C systems programming including file I/O, process management,
inter-process communication, signals, and system calls for writing robust
low-level system software.

## File I/O Operations

### File Descriptors

File descriptors are integers that represent open files in Unix-like
systems. Standard file descriptors:

- `0` - Standard input (STDIN_FILENO)
- `1` - Standard output (STDOUT_FILENO)
- `2` - Standard error (STDERR_FILENO)

### Basic File Operations

```c
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#include <string.h>

int main(void) {
    int fd;
    char buffer[1024];
    ssize_t bytes_read, bytes_written;

    // Open file for reading
    fd = open("input.txt", O_RDONLY);
    if (fd == -1) {
        perror("open");
        return 1;
    }

    // Read from file
    bytes_read = read(fd, buffer, sizeof(buffer) - 1);
    if (bytes_read == -1) {
        perror("read");
        close(fd);
        return 1;
    }
    buffer[bytes_read] = '\0';

    // Close file
    if (close(fd) == -1) {
        perror("close");
        return 1;
    }

    printf("Read %zd bytes: %s\n", bytes_read, buffer);
    return 0;
}
```

### Writing to Files

```c
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>

int write_file(const char *filename, const char *data) {
    int fd;
    ssize_t bytes_written;
    size_t len = strlen(data);

    // Open file for writing, create if doesn't exist, truncate if exists
    fd = open(filename, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd == -1) {
        perror("open");
        return -1;
    }

    // Write data
    bytes_written = write(fd, data, len);
    if (bytes_written == -1) {
        perror("write");
        close(fd);
        return -1;
    }

    if ((size_t)bytes_written != len) {
        fprintf(stderr, "Partial write: %zd of %zu bytes\n",
                bytes_written, len);
        close(fd);
        return -1;
    }

    if (close(fd) == -1) {
        perror("close");
        return -1;
    }

    return 0;
}
```

### File Positioning

```c
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(void) {
    int fd;
    char buffer[10];
    off_t offset;

    fd = open("data.txt", O_RDONLY);
    if (fd == -1) {
        perror("open");
        return 1;
    }

    // Seek to byte 10 from start
    offset = lseek(fd, 10, SEEK_SET);
    if (offset == -1) {
        perror("lseek");
        close(fd);
        return 1;
    }

    // Read 10 bytes
    if (read(fd, buffer, sizeof(buffer)) == -1) {
        perror("read");
        close(fd);
        return 1;
    }

    // Seek to end of file
    offset = lseek(fd, 0, SEEK_END);
    printf("File size: %lld bytes\n", (long long)offset);

    close(fd);
    return 0;
}
```

## Process Management

### Creating Processes with fork()

```c
#include <unistd.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/wait.h>

int main(void) {
    pid_t pid;
    int status;

    printf("Parent process (PID: %d)\n", getpid());

    pid = fork();
    if (pid == -1) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        // Child process
        printf("Child process (PID: %d, Parent: %d)\n",
               getpid(), getppid());
        sleep(2);
        printf("Child exiting\n");
        return 42;
    } else {
        // Parent process
        printf("Parent created child (PID: %d)\n", pid);

        // Wait for child to exit
        if (waitpid(pid, &status, 0) == -1) {
            perror("waitpid");
            return 1;
        }

        if (WIFEXITED(status)) {
            printf("Child exited with status: %d\n",
                   WEXITSTATUS(status));
        }
    }

    return 0;
}
```

### Executing Programs with exec()

```c
#include <unistd.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/wait.h>

int main(void) {
    pid_t pid;

    pid = fork();
    if (pid == -1) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        // Child process - execute ls command
        char *args[] = {"ls", "-l", "/tmp", NULL};
        char *envp[] = {NULL};

        execve("/bin/ls", args, envp);

        // If execve returns, an error occurred
        perror("execve");
        return 1;
    } else {
        // Parent process - wait for child
        int status;
        waitpid(pid, &status, 0);
        printf("Child completed\n");
    }

    return 0;
}
```

### Process Information

```c
#include <unistd.h>
#include <stdio.h>
#include <sys/types.h>

void print_process_info(void) {
    printf("Process ID (PID): %d\n", getpid());
    printf("Parent Process ID (PPID): %d\n", getppid());
    printf("Process Group ID (PGID): %d\n", getpgrp());
    printf("User ID (UID): %d\n", getuid());
    printf("Effective User ID (EUID): %d\n", geteuid());
    printf("Group ID (GID): %d\n", getgid());
    printf("Effective Group ID (EGID): %d\n", getegid());
}

int main(void) {
    print_process_info();
    return 0;
}
```

## Inter-Process Communication

### Pipes

```c
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>

int main(void) {
    int pipefd[2];
    pid_t pid;
    char buffer[100];

    // Create pipe
    if (pipe(pipefd) == -1) {
        perror("pipe");
        return 1;
    }

    pid = fork();
    if (pid == -1) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        // Child process - writes to pipe
        close(pipefd[0]);  // Close read end

        const char *msg = "Hello from child process!";
        write(pipefd[1], msg, strlen(msg) + 1);
        close(pipefd[1]);

        return 0;
    } else {
        // Parent process - reads from pipe
        close(pipefd[1]);  // Close write end

        read(pipefd[0], buffer, sizeof(buffer));
        printf("Parent received: %s\n", buffer);
        close(pipefd[0]);

        wait(NULL);
    }

    return 0;
}
```

### Named Pipes (FIFOs)

```c
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

// Writer process
void fifo_writer(void) {
    const char *fifo_path = "/tmp/myfifo";
    int fd;
    const char *msg = "Message through FIFO";

    // Create FIFO if it doesn't exist
    if (mkfifo(fifo_path, 0666) == -1) {
        perror("mkfifo");
        // Continue if already exists
    }

    fd = open(fifo_path, O_WRONLY);
    if (fd == -1) {
        perror("open");
        return;
    }

    write(fd, msg, strlen(msg) + 1);
    close(fd);
}

// Reader process
void fifo_reader(void) {
    const char *fifo_path = "/tmp/myfifo";
    int fd;
    char buffer[100];

    fd = open(fifo_path, O_RDONLY);
    if (fd == -1) {
        perror("open");
        return;
    }

    read(fd, buffer, sizeof(buffer));
    printf("Received: %s\n", buffer);
    close(fd);

    unlink(fifo_path);
}
```

## Signal Handling

### Basic Signal Handling

```c
#include <signal.h>
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

volatile sig_atomic_t keep_running = 1;

void signal_handler(int signum) {
    if (signum == SIGINT) {
        printf("\nReceived SIGINT (Ctrl+C)\n");
        keep_running = 0;
    } else if (signum == SIGTERM) {
        printf("Received SIGTERM\n");
        keep_running = 0;
    }
}

int main(void) {
    struct sigaction sa;

    // Setup signal handler
    sa.sa_handler = signal_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;

    if (sigaction(SIGINT, &sa, NULL) == -1) {
        perror("sigaction SIGINT");
        return 1;
    }

    if (sigaction(SIGTERM, &sa, NULL) == -1) {
        perror("sigaction SIGTERM");
        return 1;
    }

    printf("Running... Press Ctrl+C to stop\n");
    while (keep_running) {
        printf("Working...\n");
        sleep(1);
    }

    printf("Cleaning up and exiting\n");
    return 0;
}
```

### Sending Signals

```c
#include <signal.h>
#include <unistd.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/wait.h>

int main(void) {
    pid_t pid;

    pid = fork();
    if (pid == -1) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        // Child process - pause until signal received
        printf("Child waiting for signal...\n");
        pause();
        printf("Child received signal\n");
        return 0;
    } else {
        // Parent process - send signal after delay
        printf("Parent sleeping...\n");
        sleep(2);

        printf("Parent sending SIGUSR1 to child\n");
        if (kill(pid, SIGUSR1) == -1) {
            perror("kill");
            return 1;
        }

        wait(NULL);
        printf("Child process completed\n");
    }

    return 0;
}
```

### Signal Masking

```c
#include <signal.h>
#include <stdio.h>
#include <unistd.h>

int main(void) {
    sigset_t set, oldset;

    // Initialize signal set
    sigemptyset(&set);
    sigaddset(&set, SIGINT);

    // Block SIGINT
    if (sigprocmask(SIG_BLOCK, &set, &oldset) == -1) {
        perror("sigprocmask");
        return 1;
    }

    printf("SIGINT blocked for 5 seconds (Ctrl+C won't work)\n");
    sleep(5);

    // Unblock SIGINT
    if (sigprocmask(SIG_SETMASK, &oldset, NULL) == -1) {
        perror("sigprocmask");
        return 1;
    }

    printf("SIGINT unblocked (Ctrl+C will work now)\n");
    sleep(5);

    return 0;
}
```

## System Calls

### Common System Calls

```c
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <stdio.h>
#include <time.h>

void demonstrate_system_calls(void) {
    struct stat file_stat;
    char cwd[1024];
    time_t current_time;

    // Get current working directory
    if (getcwd(cwd, sizeof(cwd)) != NULL) {
        printf("Current directory: %s\n", cwd);
    }

    // Get file information
    if (stat("/etc/passwd", &file_stat) == 0) {
        printf("File size: %lld bytes\n",
               (long long)file_stat.st_size);
        printf("Permissions: %o\n", file_stat.st_mode & 0777);
        printf("Last modified: %s", ctime(&file_stat.st_mtime));
    }

    // Get current time
    current_time = time(NULL);
    printf("Current time: %s", ctime(&current_time));

    // Get process times
    printf("Process times:\n");
    printf("  Ticks per second: %ld\n", sysconf(_SC_CLK_TCK));
}
```

### Directory Operations

```c
#include <sys/types.h>
#include <dirent.h>
#include <stdio.h>
#include <errno.h>

int list_directory(const char *path) {
    DIR *dir;
    struct dirent *entry;

    dir = opendir(path);
    if (dir == NULL) {
        perror("opendir");
        return -1;
    }

    printf("Contents of %s:\n", path);
    errno = 0;
    while ((entry = readdir(dir)) != NULL) {
        printf("  %s (type: %d)\n", entry->d_name, entry->d_type);
    }

    if (errno != 0) {
        perror("readdir");
        closedir(dir);
        return -1;
    }

    if (closedir(dir) == -1) {
        perror("closedir");
        return -1;
    }

    return 0;
}
```

## Error Handling

### Using errno

```c
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>

void demonstrate_error_handling(void) {
    int fd;

    // Attempt to open non-existent file
    fd = open("/nonexistent/file.txt", O_RDONLY);
    if (fd == -1) {
        int saved_errno = errno;  // Save errno immediately

        printf("Error code: %d\n", saved_errno);
        printf("Error message (strerror): %s\n", strerror(saved_errno));

        // Alternative using perror
        errno = saved_errno;
        perror("open");

        // Check specific error
        if (saved_errno == ENOENT) {
            fprintf(stderr, "File does not exist\n");
        } else if (saved_errno == EACCES) {
            fprintf(stderr, "Permission denied\n");
        }
    }
}
```

### Robust Error Handling Pattern

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>

int copy_file(const char *src, const char *dst) {
    int src_fd = -1, dst_fd = -1;
    char buffer[4096];
    ssize_t bytes_read, bytes_written;
    int ret = -1;

    // Open source file
    src_fd = open(src, O_RDONLY);
    if (src_fd == -1) {
        fprintf(stderr, "Cannot open source file %s: %s\n",
                src, strerror(errno));
        goto cleanup;
    }

    // Open destination file
    dst_fd = open(dst, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (dst_fd == -1) {
        fprintf(stderr, "Cannot open destination file %s: %s\n",
                dst, strerror(errno));
        goto cleanup;
    }

    // Copy data
    while ((bytes_read = read(src_fd, buffer, sizeof(buffer))) > 0) {
        bytes_written = write(dst_fd, buffer, bytes_read);
        if (bytes_written != bytes_read) {
            fprintf(stderr, "Write error: %s\n", strerror(errno));
            goto cleanup;
        }
    }

    if (bytes_read == -1) {
        fprintf(stderr, "Read error: %s\n", strerror(errno));
        goto cleanup;
    }

    ret = 0;  // Success

cleanup:
    if (src_fd != -1) close(src_fd);
    if (dst_fd != -1) close(dst_fd);
    return ret;
}
```

## POSIX APIs

### POSIX Threads Basics

```c
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

void *thread_function(void *arg) {
    int *value = (int *)arg;
    printf("Thread running with value: %d\n", *value);
    sleep(1);
    *value = 100;
    return value;
}

int main(void) {
    pthread_t thread;
    int value = 42;
    void *result;

    if (pthread_create(&thread, NULL, thread_function, &value) != 0) {
        perror("pthread_create");
        return 1;
    }

    printf("Main thread waiting...\n");

    if (pthread_join(thread, &result) != 0) {
        perror("pthread_join");
        return 1;
    }

    printf("Thread returned: %d\n", *(int *)result);
    return 0;
}
```

### POSIX Shared Memory

```c
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

int main(void) {
    const char *name = "/my_shm";
    const size_t size = 4096;
    int shm_fd;
    void *ptr;

    // Create shared memory object
    shm_fd = shm_open(name, O_CREAT | O_RDWR, 0666);
    if (shm_fd == -1) {
        perror("shm_open");
        return 1;
    }

    // Set size
    if (ftruncate(shm_fd, size) == -1) {
        perror("ftruncate");
        return 1;
    }

    // Map shared memory
    ptr = mmap(0, size, PROT_READ | PROT_WRITE, MAP_SHARED, shm_fd, 0);
    if (ptr == MAP_FAILED) {
        perror("mmap");
        return 1;
    }

    // Write to shared memory
    strcpy((char *)ptr, "Hello, shared memory!");

    // Cleanup
    munmap(ptr, size);
    close(shm_fd);
    shm_unlink(name);

    return 0;
}
```

## Best Practices

1. **Always Check Return Values**: Every system call can fail. Check return
   values and handle errors appropriately using errno, perror, or strerror.

2. **Use Signal-Safe Functions**: In signal handlers, only use
   async-signal-safe functions. Avoid printf, malloc, and other non-reentrant
   functions.

3. **Close File Descriptors**: Always close file descriptors when done to
   prevent resource leaks. Use cleanup patterns with goto for complex error
   handling.

4. **Handle Partial I/O**: read() and write() may transfer fewer bytes than
   requested. Always check return values and loop when necessary.

5. **Use O_CLOEXEC**: When opening files, use O_CLOEXEC flag to prevent
   file descriptor leaks across exec() calls.

6. **Proper Process Cleanup**: Always wait for child processes using wait()
   or waitpid() to prevent zombie processes.

7. **Use sigaction Over signal**: The sigaction() interface is more portable
   and reliable than the older signal() function.

8. **Avoid Race Conditions**: Be careful with signals and file operations.
   Use proper synchronization mechanisms like mutexes or semaphores.

9. **Set Signal Masks Carefully**: Block signals during critical sections to
   prevent race conditions, but restore the original mask afterward.

10. **Use POSIX Standards**: Prefer POSIX-compliant functions over
    system-specific extensions for better portability across Unix-like
    systems.

## Common Pitfalls

1. **Ignoring errno**: Not checking errno after system call failures or
   checking it when no error occurred can lead to misleading error messages.

2. **File Descriptor Leaks**: Forgetting to close file descriptors in error
   paths causes resource exhaustion over time.

3. **Zombie Processes**: Not waiting for child processes leaves zombie
   processes that consume system resources until parent exits.

4. **Signal Handler Complexity**: Using non-async-signal-safe functions in
   signal handlers can cause deadlocks or crashes.

5. **Assuming Complete I/O**: Assuming read() or write() transfers all
   requested bytes can lead to data corruption or loss.

6. **Race Conditions with fork**: File descriptors and signals can cause race
   conditions when forking. Use careful synchronization.

7. **Incorrect exec() Usage**: Forgetting the NULL terminator in argument
   arrays for exec() family functions causes undefined behavior.

8. **Buffer Overflows**: Not checking sizes when reading into buffers can
   cause security vulnerabilities and crashes.

9. **Mixing I/O Methods**: Mixing low-level I/O (open, read, write) with
   stdio (fopen, fread, fwrite) on the same file can cause buffering issues.

10. **Hardcoded Paths**: Using hardcoded paths instead of environment
    variables or configuration files reduces portability and flexibility.

## When to Use This Skill

Use C systems programming when you need to:

- Develop operating system components or kernel modules
- Create system utilities and command-line tools
- Write device drivers or low-level hardware interfaces
- Build high-performance servers requiring direct system control
- Implement process managers or job schedulers
- Create inter-process communication mechanisms
- Develop embedded systems with limited resources
- Build tools requiring precise control over processes and signals
- Implement custom file systems or storage solutions
- Work with real-time systems requiring deterministic behavior

This skill is essential for systems programmers, embedded developers, and
anyone working close to the operating system level.

## Resources

### Documentation

- The Linux Programming Interface by Michael Kerrisk
- Advanced Programming in the UNIX Environment by W. Richard Stevens
- POSIX.1-2017 specification
- Linux man-pages project: <https://man7.org/linux/man-pages/>

### Online Resources

- Linux System Call Reference: <https://syscalls.w3challs.com/>
- GNU C Library Manual: <https://www.gnu.org/software/libc/manual/>
- The Open Group Base Specifications: <https://pubs.opengroup.org/onlinepubs/9699919799/>
- Linux kernel documentation: <https://www.kernel.org/doc/html/latest/>

### Tools

- strace: Trace system calls and signals
- ltrace: Library call tracer
- gdb: GNU debugger for debugging system programs
- valgrind: Memory debugging and profiling
- perf: Linux profiling tool for performance analysis
